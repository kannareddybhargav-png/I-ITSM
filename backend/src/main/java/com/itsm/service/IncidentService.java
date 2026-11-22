package com.itsm.service;

import com.itsm.dto.Dtos.*;
import com.itsm.entity.*;
import com.itsm.exception.ApiException;
import com.itsm.observer.IncidentEvent;
import com.itsm.repository.*;
import com.itsm.strategy.PriorityStrategy;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.itsm.entity.IncidentStatus.*;

@Service
@Transactional
@RequiredArgsConstructor
public class IncidentService {
    private final IncidentRepository incidents;
    private final CategoryRepository categories;
    private final ItServiceRepository services;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final PriorityStrategy priorityStrategy;
    private final AssignmentService assignment;
    private final SlaService sla;
    private final DuplicateDetector duplicates;
    private final ApplicationEventPublisher events;

    public record Filter(IncidentStatus status, Priority priority, Long categoryId, Long serviceId,
                         Long technicianId, Long reporterId, String q, LocalDate from, String scope) {}

    // ---------- helpers ----------
    private Incident find(Long id) {
        return incidents.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Incident not found"));
    }
    private IncidentDto view(Incident i, User me) {
        String dupRef = i.getDuplicateOfId() == null ? null
                : incidents.findById(i.getDuplicateOfId()).map(Incident::getReference).orElse(null);
        return IncidentDto.from(i, dupRef).forRole(me.getRole());
    }
    private ApiException forbidden(String m) { return new ApiException(HttpStatus.FORBIDDEN, m); }
    private ApiException conflict(String m) { return new ApiException(HttpStatus.CONFLICT, m); }

    private void checkAccess(Incident i, User me) {
        boolean ok = switch (me.getRole()) {
            case ADMIN -> true;
            case EMPLOYEE -> i.getReporter().getId().equals(me.getId());
            case TECHNICIAN -> true; // technicians may read every incident; only the assigned one can act on it
        };
        if (!ok) throw forbidden("You do not have access to this incident");
    }
    private void requireAssignedTech(Incident i, User me) {
        if (i.getTechnician() == null || !i.getTechnician().getId().equals(me.getId()))
            throw forbidden("Only the assigned technician can do this");
    }
    private void requireReporterOrAdmin(Incident i, User me) {
        if (me.getRole() != Role.ADMIN && !i.getReporter().getId().equals(me.getId()))
            throw forbidden("Only the reporter or an administrator can do this");
    }

    /** Single place where lifecycle transitions are validated (State pattern) and announced (Observer pattern). */
    private void move(Incident i, IncidentStatus to, String action, User actor, String desc) {
        IncidentStatus old = i.getStatus();
        if (!old.canMoveTo(to)) throw conflict("Invalid status transition " + old + " -> " + to);
        i.setStatus(to);
        incidents.save(i);
        events.publishEvent(new IncidentEvent(i, action, old, to, actor, desc));
    }
    private void log(Incident i, String action, User actor, String desc) {
        events.publishEvent(new IncidentEvent(i, action, i.getStatus(), i.getStatus(), actor, desc));
    }
    /** Impact = weight of the affected service, criticality = weight of the category (both admin-editable). */
    private void prioritize(Incident i) {
        i.setImpact(i.getService().getCriticality());
        Integer weight = i.getCategory().getCriticality();
        i.setCriticality(weight == null ? 3 : weight);
        int score = priorityStrategy.score(i);
        i.setScore(score);
        i.setPriority(priorityStrategy.classify(score));
        sla.applyDeadlines(i);
    }

    // ---------- queries ----------
    private static final java.util.regex.Pattern REF =
            java.util.regex.Pattern.compile("(?i)inc-(?:p\\d-)?0*(\\d+)(?:-d(\\d+))?");

    @Transactional(readOnly = true)
    public List<IncidentDto> search(Filter f, User me) {
        Specification<Incident> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            boolean all = "all".equalsIgnoreCase(f.scope());
            boolean mine = "mine".equalsIgnoreCase(f.scope());
            switch (me.getRole()) {
                // Employees only ever see the incidents they reported.
                case EMPLOYEE -> p.add(cb.equal(root.get("reporter").get("id"), me.getId()));
                // Technician: "mine" (default) = every incident assigned to me, past and present; "all" = everything.
                case TECHNICIAN -> { if (!all) p.add(cb.equal(root.get("technician").get("id"), me.getId())); }
                // Administrator: "mine" = incidents I reported; "all" (default) = everything.
                case ADMIN -> { if (mine) p.add(cb.equal(root.get("reporter").get("id"), me.getId())); }
            }
            if (f.status() != null) p.add(cb.equal(root.get("status"), f.status()));
            if (f.priority() != null) p.add(cb.equal(root.get("priority"), f.priority()));
            if (f.categoryId() != null) p.add(cb.equal(root.get("category").get("id"), f.categoryId()));
            if (f.serviceId() != null) p.add(cb.equal(root.get("service").get("id"), f.serviceId()));
            if (f.technicianId() != null) p.add(cb.equal(root.get("technician").get("id"), f.technicianId()));
            if (f.reporterId() != null) p.add(cb.equal(root.get("reporter").get("id"), f.reporterId()));
            java.util.regex.Matcher ref = f.q() == null ? null : REF.matcher(f.q().trim());
            if (ref != null && ref.matches()) {
                // Searching by reference, e.g. INC-P3-0003, INC-0003 or INC-P3-0003-D1.
                p.add(cb.equal(root.get("refNumber"), Long.parseLong(ref.group(1))));
                if (ref.group(2) != null) p.add(cb.equal(root.get("duplicateSeq"), Integer.parseInt(ref.group(2))));
            } else if (f.q() != null && !f.q().isBlank()) {
                String like = "%" + f.q().trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("title")), like), cb.like(cb.lower(root.get("description")), like)));
            }
            if (f.from() != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.from().atStartOfDay(ZoneOffset.UTC).toInstant()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return incidents.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt")).stream().map(x -> view(x, me)).toList();
    }

    @Transactional(readOnly = true)
    public IncidentDto get(Long id, User me) {
        Incident i = find(id);
        checkAccess(i, me);
        return view(i, me);
    }

    @Transactional(readOnly = true)
    public List<AuditDto> history(Long id, User me) {
        Incident i = find(id);
        checkAccess(i, me);
        List<AuditDto> list = audit.findByIncidentIdOrderByTimestampAsc(id).stream().map(AuditDto::from).toList();
        if (me.getRole() != Role.TECHNICIAN) return list;
        // Technicians do not see how the priority was calculated.
        return list.stream().map(a -> "PRIORITIZED".equals(a.action())
                ? new AuditDto(a.action(), a.actor(), a.oldStatus(), a.newStatus(), "Priority calculated automatically: " + i.getPriority(), a.timestamp())
                : a).toList();
    }

    // ---------- commands ----------
    public IncidentDto create(CreateIncidentRequest r, User me) {
        if (me.getRole() == Role.EMPLOYEE && !me.isVerified())
            throw forbidden("Your account is waiting for administrator verification. You can report incidents once it is verified.");
        Category c = categories.findById(r.categoryId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Unknown category"));
        ItService s = services.findById(r.serviceId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Unknown IT service"));
        String title = r.title().trim();
        String desc = r.description().trim();
        // Guard against double submits: the same reporter sending the same text within 10 seconds gets the existing incident.
        Optional<Incident> recent = incidents.findFirstByReporterIdAndTitleAndDescriptionAndCreatedAtAfter(
                me.getId(), title, desc, Instant.now().minusSeconds(10));
        if (recent.isPresent()) return view(recent.get(), me);
        Incident i = new Incident();
        i.setTitle(title);
        i.setDescription(desc);
        i.setCategory(c);
        i.setService(s);
        i.setUrgency(r.urgency());
        i.setAffectedUsers(r.affectedUsers() == null ? 1 : r.affectedUsers());
        i.setReporter(me);
        i.setCreatedAt(Instant.now());
        i.setStatus(NEW);
        incidents.save(i);
        // Priority and duplicate link are worked out before any event is published, so every notification and
        // history entry already carries the final reference (e.g. INC-P3-0003-D1).
        prioritize(i);
        List<DuplicateDetector.Match> matches = duplicates.findSimilar(i,
                incidents.findByStatusNotInAndCreatedAtAfter(List.of(VERIFIED, CLOSED), Instant.now().minus(Duration.ofHours(48))));
        Incident original = matches.isEmpty() ? null : matches.get(0).incident();
        if (original == null) {
            i.setRefNumber(i.getId());
        } else {
            // Duplicates share the base number of the first incident in the chain and get the next -D sequence.
            Long base = original.getRefNumber() != null ? original.getRefNumber()
                    : (original.getDuplicateOfId() != null ? original.getDuplicateOfId() : original.getId());
            i.setDuplicateOfId(original.getId());
            i.setRefNumber(base);
            i.setDuplicateSeq((int) incidents.countByRefNumberAndDuplicateSeqNotNull(base) + 1);
        }
        incidents.save(i);

        events.publishEvent(new IncidentEvent(i, "CREATED", null, NEW, me, "Incident reported: " + i.getTitle()));
        move(i, CLASSIFIED, "CLASSIFIED", null, "Category: " + c.getName() + ", service: " + s.getName());
        move(i, PRIORITIZED, "PRIORITIZED", null, "Service impact " + i.getImpact() + " x category criticality "
                + i.getCriticality() + " x urgency " + i.getUrgency()
                + (i.getAffectedUsers() > 1 ? ", " + i.getAffectedUsers() + " users affected" : "")
                + " = " + i.getScore() + " -> " + i.getPriority());

        // A technician already working on the original is preferred; otherwise the active strategy decides.
        User preferred = (original != null && original.getTechnician() != null && original.getTechnician().isAvailable())
                ? original.getTechnician() : null;
        String how = preferred != null ? "(same technician as possible duplicate " + original.getReference() + ")"
                : "using " + assignment.getActive();
        Optional<User> chosen = preferred != null ? Optional.of(preferred) : assignment.pick(i);
        chosen.ifPresent(t -> {
            i.setTechnician(t);
            move(i, ASSIGNED, "ASSIGNED", null, "Auto-assigned to " + t.getName() + " " + how);
        });

        if (original != null) {
            int pct = (int) Math.round(matches.get(0).similarity() * 100);
            log(i, "DUPLICATE_DETECTED", null, "Possible duplicate of " + original.getReference() + " (" + pct + "% keyword overlap"
                    + (matches.size() > 1 ? ", " + (matches.size() - 1) + " more similar open incident(s)" : "") + ")");
        }
        return view(i, me);
    }

    public IncidentDto update(Long id, UpdateIncidentRequest r, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        if (me.getRole() != Role.ADMIN && i.getStatus().ordinal() > ASSIGNED.ordinal())
            throw conflict("Incident can no longer be edited");
        i.setTitle(r.title().trim());
        i.setDescription(r.description().trim());
        i.setUrgency(r.urgency());
        if (r.affectedUsers() != null) i.setAffectedUsers(r.affectedUsers());
        Priority before = i.getPriority();
        prioritize(i);
        incidents.save(i);
        log(i, "UPDATED", me, "Incident details updated");
        if (before != i.getPriority()) log(i, "PRIORITY_CHANGED", me, before + " -> " + i.getPriority());
        return view(i, me);
    }

    public void delete(Long id, User me) {
        Incident i = find(id);
        log(i, "DELETED", me, "Incident deleted by administrator");
        incidents.delete(i);
    }

    public IncidentDto assign(Long id, Long technicianId, User me) {
        Incident i = find(id);
        if (i.getStatus() != PRIORITIZED && i.getStatus() != ASSIGNED)
            throw conflict("Incident cannot be (re)assigned while " + i.getStatus());
        User tech;
        if (technicianId != null) {
            tech = users.findById(technicianId).filter(u -> u.getRole() == Role.TECHNICIAN)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Technician not found"));
            if (!tech.isAvailable()) throw conflict("Technician is unavailable");
        } else {
            tech = assignment.pick(i).orElseThrow(() -> conflict("No suitable technician available"));
        }
        boolean reassign = i.getStatus() == ASSIGNED;
        i.setTechnician(tech);
        String d = "Assigned to " + tech.getName() + (technicianId == null ? " using " + assignment.getActive() : " manually");
        if (reassign) { incidents.save(i); log(i, "REASSIGNED", me, d); }
        else move(i, ASSIGNED, "ASSIGNED", me, d);
        return view(i, me);
    }

    public IncidentDto acknowledge(Long id, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        Instant now = Instant.now();
        i.setAcknowledgedAt(now);
        if (i.getResponseDeadline() != null && now.isAfter(i.getResponseDeadline()) && !i.isResponseViolated()) {
            i.setResponseViolated(true);
            i.setResponseBreachTechnicianId(me.getId());
        }
        move(i, ACKNOWLEDGED, "ACKNOWLEDGED", me, "Technician acknowledged the incident");
        return view(i, me);
    }

    public IncidentDto start(Long id, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        move(i, IN_PROGRESS, "INVESTIGATION_STARTED", me, "Investigation started");
        return view(i, me);
    }

    public IncidentDto addNote(Long id, String text, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        if (i.getStatus() == ACKNOWLEDGED) move(i, IN_PROGRESS, "INVESTIGATION_STARTED", me, "Investigation started");
        else if (i.getStatus() != IN_PROGRESS) throw conflict("Notes can only be added while investigating");
        log(i, "NOTE_ADDED", me, text);
        return view(i, me);
    }

    public IncidentDto resolve(Long id, String text, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        Instant now = Instant.now();
        i.setResolution(text);
        i.setResolvedAt(now);
        if (i.getResolutionDeadline() != null && now.isAfter(i.getResolutionDeadline()) && !i.isResolutionViolated()) {
            i.setResolutionViolated(true);
            i.setResolutionBreachTechnicianId(me.getId());
        }
        move(i, RESOLVED, "RESOLVED", me, "Resolution: " + text);
        return view(i, me);
    }

    /** The reporter must rate the resolution (1-5 stars, written comment optional) when confirming it. */
    public IncidentDto verify(Long id, FeedbackRequest r, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        Integer stars = r == null ? null : r.rating();
        boolean reporter = i.getReporter().getId().equals(me.getId());
        if ((reporter && stars == null) || (stars != null && (stars < 1 || stars > 5)))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please rate the resolution with 1 to 5 stars before confirming it.");
        String comment = null;
        if (stars != null) {
            comment = r.comment() == null ? "" : r.comment().trim();
            if (comment.length() > 1000) comment = comment.substring(0, 1000);
            if (comment.isEmpty()) comment = null;
            i.setRating(stars);
            i.setFeedback(comment);
            i.setRatedAt(Instant.now());
        }
        move(i, VERIFIED, "VERIFIED", me, stars == null ? "Resolution verified"
                : "Resolution verified, rated " + stars + "/5" + (comment == null ? "" : ": " + comment));
        return view(i, me);
    }

    public IncidentDto reopen(Long id, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        i.setResolvedAt(null);
        move(i, IN_PROGRESS, "REOPENED", me, "Resolution rejected, incident reopened");
        return view(i, me);
    }

    public IncidentDto close(Long id, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        move(i, CLOSED, "CLOSED", me, "Incident closed");
        return view(i, me);
    }

    @Transactional(readOnly = true)
    public List<IncidentDto> related(Long id, User me) {
        if (me.getRole() == Role.EMPLOYEE) throw forbidden("Related incidents are visible to technicians and administrators");
        Incident i = find(id);
        checkAccess(i, me);
        List<Incident> out = new java.util.ArrayList<>();
        if (i.getDuplicateOfId() != null) incidents.findById(i.getDuplicateOfId()).ifPresent(out::add);
        out.addAll(incidents.findByDuplicateOfId(id));
        return out.stream().map(x -> view(x, me)).toList();
    }

    private static final List<Priority> ESCALATING = List.of(Priority.P1, Priority.P2);

    /**
     * Automatic escalation of unacknowledged P1/P2 incidents (called by the scheduler).
     * Level 1: response deadline passed -> administrators are alerted.
     * Level 2: a further full response window passed -> escalated to IT management and reassigned to another technician.
     */
    public void checkEscalations() {
        Instant now = Instant.now();
        for (Incident i : incidents.findByAcknowledgedAtIsNullAndPriorityInAndStatusIn(ESCALATING, List.of(PRIORITIZED, ASSIGNED))) {
            if (i.getResponseDeadline() == null) continue;
            long window = Duration.between(i.getCreatedAt(), i.getResponseDeadline()).toMillis();
            long overdue = Duration.between(i.getResponseDeadline(), now).toMillis();
            int level = overdue < 0 ? 0 : (overdue < window ? 1 : 2);
            int current = i.getEscalationLevel() == null ? 0 : i.getEscalationLevel();
            if (level <= current) continue;
            i.setEscalationLevel(level);
            if (level == 1) {
                incidents.save(i);
                log(i, "ESCALATED_L1", null, "Not acknowledged in time: escalated to administrators");
                continue;
            }
            String d = "Still not acknowledged: escalated to IT management";
            Long excluded = i.getTechnician() == null ? null : i.getTechnician().getId();
            Optional<User> next = assignment.pickExcluding(i, excluded);
            if (next.isPresent()) {
                i.setTechnician(next.get());
                d += "; reassigned to " + next.get().getName();
            }
            if (next.isPresent() && i.getStatus() == PRIORITIZED) {
                move(i, ASSIGNED, "ESCALATED_L2", null, d);
            } else {
                incidents.save(i);
                log(i, "ESCALATED_L2", null, d);
            }
        }
    }

    /** A technician can ask the reporter for details while handling the incident (including before acknowledging it). */
    public IncidentDto requestInfo(Long id, String text, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        if (!List.of(ASSIGNED, ACKNOWLEDGED, IN_PROGRESS).contains(i.getStatus()))
            throw conflict("Information can only be requested while the incident is being handled");
        log(i, "INFO_REQUESTED", me, text.trim());
        return view(i, me);
    }

    /** The reporter answers a request or adds details on their own while the incident is still open. */
    public IncidentDto provideInfo(Long id, String text, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        if (i.getStatus() == VERIFIED || i.getStatus() == CLOSED) throw conflict("This incident is already closed");
        log(i, "INFO_PROVIDED", me, text.trim());
        return view(i, me);
    }
}
