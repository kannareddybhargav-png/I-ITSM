package com.itsm.service;

import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.ItService;
import com.itsm.entity.Category;
import com.itsm.entity.Priority;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.repository.CategoryRepository;
import com.itsm.repository.IncidentRepository;
import com.itsm.repository.ItServiceRepository;
import com.itsm.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * Operational reports for administrators: incident overview, service analysis, category analysis,
 * priority distribution, status breakdown and technician workload.
 * The aggregation itself is a pure static method so it can be unit tested without a database.
 */
@Service
@RequiredArgsConstructor
public class ReportService {
    public static final Set<IncidentStatus> OPEN = EnumSet.of(IncidentStatus.NEW, IncidentStatus.CLASSIFIED,
            IncidentStatus.PRIORITIZED, IncidentStatus.ASSIGNED, IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS);
    public static final Set<IncidentStatus> DONE = EnumSet.of(IncidentStatus.RESOLVED, IncidentStatus.VERIFIED, IncidentStatus.CLOSED);

    /** One line of a breakdown table (per service, per category or per priority). */
    public record Row(String name, long total, long open, long critical, long breached, long atRisk, long resolved) {}
    public record TechRow(Long id, String name, boolean available, long active, long handled, long breached,
                          double rating, int reviews) {}
    public record Overview(long total, long open, long criticalOpen, long resolved, long breached, long atRisk,
                           long escalatedOpen, long duplicates, Double slaCompliancePercent, Double avgResolutionHours) {}
    public record Summary(Instant generatedAt, int warningPercent, Overview overview, List<Row> byService,
                          List<Row> byCategory, List<Row> byPriority, Map<String, Long> byStatus, List<TechRow> technicians) {}

    private final IncidentRepository incidents;
    private final ItServiceRepository services;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final AssignmentService assignment;
    private final RatingService ratings;
    private final SlaService sla;

    @Transactional(readOnly = true)
    public Summary summary() {
        Instant now = Instant.now();
        List<Incident> all = incidents.findAll();
        List<String> serviceNames = services.findAll().stream().map(ItService::getName).toList();
        List<String> categoryNames = categories.findAll().stream().map(Category::getName).toList();
        Summary base = summarize(all, serviceNames, categoryNames, now, sla.getWarningPercent());

        List<TechRow> techs = new ArrayList<>();
        for (User u : users.findByRole(Role.TECHNICIAN)) {
            List<Incident> mine = all.stream()
                    .filter(i -> i.getTechnician() != null && Objects.equals(i.getTechnician().getId(), u.getId())).toList();
            RatingService.Rating r = ratings.forTechnician(u.getId());
            techs.add(new TechRow(u.getId(), u.getName(), u.isAvailable(), assignment.workload(u.getId()),
                    mine.size(), mine.stream().filter(ReportService::breached).count(), r.score(), r.reviews()));
        }
        techs.sort(Comparator.comparingLong(TechRow::active).reversed().thenComparing(TechRow::name));
        return new Summary(base.generatedAt(), base.warningPercent(), base.overview(), base.byService(),
                base.byCategory(), base.byPriority(), base.byStatus(), techs);
    }

    public static boolean breached(Incident i) { return i.isResponseViolated() || i.isResolutionViolated(); }

    /** Open, not breached yet, and at least warningPercent of a running SLA window used up. */
    public static boolean atRisk(Incident i, Instant now, int warningPercent) {
        if (i.getStatus() == null || !OPEN.contains(i.getStatus()) || breached(i)) return false;
        boolean response = i.getAcknowledgedAt() == null
                && SlaService.atRisk(i.getCreatedAt(), i.getResponseDeadline(), now, warningPercent);
        boolean resolution = i.getResolvedAt() == null
                && SlaService.atRisk(i.getCreatedAt(), i.getResolutionDeadline(), now, warningPercent);
        return response || resolution;
    }

    public static Summary summarize(Collection<Incident> all, Collection<String> serviceNames,
                                    Collection<String> categoryNames, Instant now, int warningPercent) {
        long open = all.stream().filter(i -> i.getStatus() != null && OPEN.contains(i.getStatus())).count();
        long criticalOpen = all.stream().filter(i -> i.getStatus() != null && OPEN.contains(i.getStatus())
                && (i.getPriority() == Priority.P1 || i.getPriority() == Priority.P2)).count();
        List<Incident> done = all.stream().filter(i -> i.getStatus() != null && DONE.contains(i.getStatus())).toList();
        long breached = all.stream().filter(ReportService::breached).count();
        long atRisk = all.stream().filter(i -> atRisk(i, now, warningPercent)).count();
        long escalatedOpen = all.stream().filter(i -> i.getStatus() != null && OPEN.contains(i.getStatus())
                && i.getEscalationLevel() != null && i.getEscalationLevel() > 0).count();
        long duplicates = all.stream().filter(i -> i.getDuplicateOfId() != null).count();

        Double compliance = done.isEmpty() ? null
                : round1(100.0 * done.stream().filter(i -> !breached(i)).count() / done.size());
        List<Long> minutes = done.stream().filter(i -> i.getCreatedAt() != null && i.getResolvedAt() != null)
                .map(i -> Duration.between(i.getCreatedAt(), i.getResolvedAt()).toMinutes()).toList();
        Double avgHours = minutes.isEmpty() ? null
                : round1(minutes.stream().mapToLong(Long::longValue).average().orElse(0) / 60.0);

        Overview overview = new Overview(all.size(), open, criticalOpen, done.size(), breached, atRisk,
                escalatedOpen, duplicates, compliance, avgHours);

        List<Row> byService = rows(all, i -> i.getService() == null ? "Unknown" : i.getService().getName(), serviceNames, now, warningPercent);
        List<Row> byCategory = rows(all, i -> i.getCategory() == null ? "Unknown" : i.getCategory().getName(), categoryNames, now, warningPercent);
        List<Row> byPriority = rows(all, i -> i.getPriority() == null ? "None" : i.getPriority().name(),
                List.of("P1", "P2", "P3", "P4"), now, warningPercent);
        byPriority.sort(Comparator.comparing(Row::name));

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (IncidentStatus s : IncidentStatus.values()) {
            byStatus.put(s.name(), all.stream().filter(i -> i.getStatus() == s).count());
        }
        return new Summary(now, warningPercent, overview, byService, byCategory, byPriority, byStatus, List.of());
    }

    /** Groups incidents by a name; every known name appears even with zero incidents. Sorted by total, then name. */
    private static List<Row> rows(Collection<Incident> all, Function<Incident, String> key, Collection<String> known,
                                  Instant now, int warningPercent) {
        Map<String, List<Incident>> groups = new LinkedHashMap<>();
        for (String k : known) groups.put(k, new ArrayList<>());
        for (Incident i : all) groups.computeIfAbsent(key.apply(i), k -> new ArrayList<>()).add(i);
        List<Row> out = new ArrayList<>();
        groups.forEach((name, list) -> out.add(new Row(name, list.size(),
                list.stream().filter(i -> i.getStatus() != null && OPEN.contains(i.getStatus())).count(),
                list.stream().filter(i -> i.getPriority() == Priority.P1 || i.getPriority() == Priority.P2).count(),
                list.stream().filter(ReportService::breached).count(),
                list.stream().filter(i -> atRisk(i, now, warningPercent)).count(),
                list.stream().filter(i -> i.getStatus() != null && DONE.contains(i.getStatus())).count())));
        out.sort(Comparator.comparingLong(Row::total).reversed().thenComparing(Row::name));
        return out;
    }

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
}
