package com.itsm.controller;

import com.itsm.entity.AuditLog;
import com.itsm.entity.Incident;
import com.itsm.repository.AuditLogRepository;
import com.itsm.repository.IncidentRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** Read-only, administrator-only view of the audit trail across all incidents. There is no way to change or delete entries. */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {
    public record Entry(Long id, Long incidentId, String reference, String action, String actor,
                        String oldStatus, String newStatus, String description, Instant timestamp) {}
    public record AuditPage(List<Entry> items, int page, int totalPages, long total) {}

    private final AuditLogRepository audit;
    private final IncidentRepository incidents;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public AuditPage list(@RequestParam(required = false) String action,
                          @RequestParam(required = false) String actor,
                          @RequestParam(required = false) String incident,
                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                          @RequestParam(defaultValue = "0") int page,
                          @RequestParam(defaultValue = "25") int size) {
        final List<Long> ids = (incident == null || incident.isBlank()) ? null : matchIncidents(incident);
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (action != null && !action.isBlank()) p.add(cb.equal(root.get("action"), action.trim()));
            if (actor != null && !actor.isBlank()) p.add(cb.like(cb.lower(root.get("actor")), "%" + actor.trim().toLowerCase() + "%"));
            if (ids != null) p.add(ids.isEmpty() ? cb.disjunction() : root.get("incidentId").in(ids));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.<Instant>get("timestamp"), from.atStartOfDay(ZoneOffset.UTC).toInstant()));
            if (to != null) p.add(cb.lessThan(root.<Instant>get("timestamp"), to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        Page<AuditLog> result = audit.findAll(spec,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 1000), Sort.by(Sort.Direction.DESC, "timestamp", "id")));
        Map<Long, String> refs = incidents.findAllById(
                        result.getContent().stream().map(AuditLog::getIncidentId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(Incident::getId, Incident::getReference));
        List<Entry> items = result.getContent().stream().map(a -> new Entry(a.getId(), a.getIncidentId(),
                refs.getOrDefault(a.getIncidentId(), "#" + a.getIncidentId() + " (deleted)"),
                a.getAction(), a.getActor(), a.getOldStatus(), a.getNewStatus(), a.getDescription(), a.getTimestamp())).toList();
        return new AuditPage(items, result.getNumber(), result.getTotalPages(), result.getTotalElements());
    }

    /** A plain number matches that incident id exactly; anything else is matched against the incident references. */
    private List<Long> matchIncidents(String text) {
        String q = text.trim().toLowerCase().replace("#", "");
        if (q.matches("\\d+")) return List.of(Long.parseLong(q));
        return incidents.findAll().stream().filter(i -> i.getReference().toLowerCase().contains(q)).map(Incident::getId).toList();
    }
}
