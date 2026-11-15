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
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

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
    private final ApplicationEventPublisher events;

    public record Filter(IncidentStatus status, Priority priority, Long categoryId, Long serviceId,
                         Long technicianId, Long reporterId, String q, LocalDate from) {}

    // ---------- helpers ----------
    private Incident find(Long id) {
        return incidents.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Incident not found"));
    }
    private ApiException forbidden(String m) { return new ApiException(HttpStatus.FORBIDDEN, m); }
    private ApiException conflict(String m) { return new ApiException(HttpStatus.CONFLICT, m); }

    private void checkAccess(Incident i, User me) {
        boolean ok = switch (me.getRole()) {
            case ADMIN -> true;
            case EMPLOYEE -> i.getReporter().getId().equals(me.getId());
            case TECHNICIAN -> i.getTechnician() != null && i.getTechnician().getId().equals(me.getId());
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
    private void prioritize(Incident i) {
        int score = priorityStrategy.score(i);
        i.setScore(score);
        i.setPriority(priorityStrategy.classify(score));
        sla.applyDeadlines(i);
    }

    // ---------- queries ----------
    @Transactional(readOnly = true)
    public List<IncidentDto> search(Filter f, User me) {
        Specification<Incident> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (me.getRole() == Role.EMPLOYEE) p.add(cb.equal(root.get("reporter").get("id"), me.getId()));
            if (me.getRole() == Role.TECHNICIAN) p.add(cb.equal(root.get("technician").get("id"), me.getId()));
            if (f.status() != null) p.add(cb.equal(root.get("status"), f.status()));
            if (f.priority() != null) p.add(cb.equal(root.get("priority"), f.priority()));
            if (f.categoryId() != null) p.add(cb.equal(root.get("category").get("id"), f.categoryId()));
            if (f.serviceId() != null) p.add(cb.equal(root.get("service").get("id"), f.serviceId()));
            if (f.technicianId() != null) p.add(cb.equal(root.get("technician").get("id"), f.technicianId()));
            if (f.reporterId() != null) p.add(cb.equal(root.get("reporter").get("id"), f.reporterId()));
            if (f.q() != null && !f.q().isBlank()) {
                String like = "%" + f.q().trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("title")), like), cb.like(cb.lower(root.get("description")), like)));
            }
            if (f.from() != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.from().atStartOfDay(ZoneOffset.UTC).toInstant()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return incidents.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt")).stream().map(IncidentDto::from).toList();
    }

    @Transactional(readOnly = true)
    public IncidentDto get(Long id, User me) {
        Incident i = find(id);
        checkAccess(i, me);
        return IncidentDto.from(i);
    }

    @Transactional(readOnly = true)
    public List<AuditDto> history(Long id, User me) {
        checkAccess(find(id), me);
        return audit.findByIncidentIdOrderByTimestampAsc(id).stream().map(AuditDto::from).toList();
    }

    // ---------- commands ----------
    public IncidentDto create(CreateIncidentRequest r, User me) {
        Category c = categories.findById(r.categoryId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Unknown category"));
        ItService s = services.findById(r.serviceId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Unknown IT service"));
        Incident i = new Incident();
        i.setTitle(r.title().trim());
        i.setDescription(r.description().trim());
        i.setCategory(c);
        i.setService(s);
        i.setAffectedUsers(r.affectedUsers());
        i.setImpact(r.impact());
        i.setUrgency(r.urgency());
        i.setReporter(me);
        i.setCreatedAt(Instant.now());
        i.setStatus(NEW);
        incidents.save(i);
        events.publishEvent(new IncidentEvent(i, "CREATED", null, NEW, me, "Incident reported: " + i.getTitle()));

        move(i, CLASSIFIED, "CLASSIFIED", null, "Category: " + c.getName() + ", service: " + s.getName());
        prioritize(i);
        move(i, PRIORITIZED, "PRIORITIZED", null, "Score " + i.getScore() + " -> " + i.getPriority());
        assignment.pick(i).ifPresent(t -> {
            i.setTechnician(t);
            move(i, ASSIGNED, "ASSIGNED", null, "Auto-assigned to " + t.getName() + " using " + assignment.getActive());
        });
        return IncidentDto.from(i);
    }

    public IncidentDto update(Long id, UpdateIncidentRequest r, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        if (me.getRole() != Role.ADMIN && i.getStatus().ordinal() > ASSIGNED.ordinal())
            throw conflict("Incident can no longer be edited");
        i.setTitle(r.title().trim());
        i.setDescription(r.description().trim());
        i.setAffectedUsers(r.affectedUsers());
        i.setImpact(r.impact());
        i.setUrgency(r.urgency());
        Priority before = i.getPriority();
        prioritize(i);
        incidents.save(i);
        log(i, "UPDATED", me, "Incident details updated");
        if (before != i.getPriority()) log(i, "PRIORITY_CHANGED", me, before + " -> " + i.getPriority());
        return IncidentDto.from(i);
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
        return IncidentDto.from(i);
    }

    public IncidentDto acknowledge(Long id, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        Instant now = Instant.now();
        i.setAcknowledgedAt(now);
        if (i.getResponseDeadline() != null && now.isAfter(i.getResponseDeadline())) i.setResponseViolated(true);
        move(i, ACKNOWLEDGED, "ACKNOWLEDGED", me, "Technician acknowledged the incident");
        return IncidentDto.from(i);
    }

    public IncidentDto start(Long id, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        move(i, IN_PROGRESS, "INVESTIGATION_STARTED", me, "Investigation started");
        return IncidentDto.from(i);
    }

    public IncidentDto addNote(Long id, String text, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        if (i.getStatus() == ACKNOWLEDGED) move(i, IN_PROGRESS, "INVESTIGATION_STARTED", me, "Investigation started");
        else if (i.getStatus() != IN_PROGRESS) throw conflict("Notes can only be added while investigating");
        log(i, "NOTE_ADDED", me, text);
        return IncidentDto.from(i);
    }

    public IncidentDto resolve(Long id, String text, User me) {
        Incident i = find(id);
        requireAssignedTech(i, me);
        Instant now = Instant.now();
        i.setResolution(text);
        i.setResolvedAt(now);
        if (i.getResolutionDeadline() != null && now.isAfter(i.getResolutionDeadline())) i.setResolutionViolated(true);
        move(i, RESOLVED, "RESOLVED", me, "Resolution: " + text);
        return IncidentDto.from(i);
    }

    public IncidentDto verify(Long id, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        move(i, VERIFIED, "VERIFIED", me, "Resolution verified");
        return IncidentDto.from(i);
    }

    public IncidentDto reopen(Long id, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        i.setResolvedAt(null);
        move(i, IN_PROGRESS, "REOPENED", me, "Resolution rejected, incident reopened");
        return IncidentDto.from(i);
    }

    public IncidentDto close(Long id, User me) {
        Incident i = find(id);
        requireReporterOrAdmin(i, me);
        move(i, CLOSED, "CLOSED", me, "Incident closed");
        return IncidentDto.from(i);
    }
}
