package com.itsm.service;

import com.itsm.entity.Incident;
import com.itsm.entity.SlaPolicy;
import com.itsm.exception.ApiException;
import com.itsm.observer.IncidentEvent;
import com.itsm.repository.IncidentRepository;
import com.itsm.repository.SlaPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;

/** SLA clock runs continuously (24x7) from incident creation. */
@Service
@RequiredArgsConstructor
public class SlaService {
    private final SlaPolicyRepository policies;
    private final IncidentRepository incidents;
    private final ApplicationEventPublisher events;
    /** Share of the SLA window after which an early warning is sent (default 80%). */
    @Value("${app.sla.warning-percent:80}") private int warningPercent;

    public void applyDeadlines(Incident i) {
        SlaPolicy p = policies.findById(i.getPriority()).orElseThrow(() ->
                new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Missing SLA configuration for " + i.getPriority()));
        i.setResponseDeadline(i.getCreatedAt().plus(Duration.ofMinutes(p.getResponseMinutes())));
        i.setResolutionDeadline(i.getCreatedAt().plus(Duration.ofMinutes(p.getResolutionMinutes())));
        // New deadlines: a warning may be needed again.
        i.setResponseWarned(false);
        i.setResolutionWarned(false);
    }

    /**
     * True when at least {@code percent}% of the time between creation and the deadline has been used up
     * and the deadline has not passed yet (a passed deadline is a violation, handled separately).
     */
    public static boolean atRisk(Instant created, Instant deadline, Instant now, int percent) {
        if (created == null || deadline == null || now == null || !now.isBefore(deadline)) return false;
        long total = Duration.between(created, deadline).toMillis();
        long used = Duration.between(created, now).toMillis();
        return total > 0 && used * 100 >= total * (long) percent;
    }

    /** Human-readable time left, e.g. "45 s", "4 min", "2 h 10 min". */
    static String timeLeft(Instant now, Instant deadline) {
        long s = Math.max(0, Duration.between(now, deadline).getSeconds());
        if (s < 60) return s + " s";
        if (s < 3600) return (s / 60) + " min";
        return (s / 3600) + " h " + ((s % 3600) / 60) + " min";
    }

    public int getWarningPercent() { return Math.max(1, Math.min(99, warningPercent)); }

    /** Called by the scheduler: flags and announces newly breached deadlines. */
    @Transactional
    public void checkViolations() {
        Instant now = Instant.now();
        for (Incident i : incidents.findByResponseViolatedFalseAndAcknowledgedAtIsNullAndResponseDeadlineBefore(now)) {
            i.setResponseViolated(true);
            if (i.getTechnician() != null) i.setResponseBreachTechnicianId(i.getTechnician().getId());
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESPONSE_VIOLATION", i.getStatus(), i.getStatus(), null,
                    "Response SLA breached (deadline " + i.getResponseDeadline() + ")"));
        }
        for (Incident i : incidents.findByResolutionViolatedFalseAndResolvedAtIsNullAndResolutionDeadlineBefore(now)) {
            i.setResolutionViolated(true);
            if (i.getTechnician() != null) i.setResolutionBreachTechnicianId(i.getTechnician().getId());
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESOLUTION_VIOLATION", i.getStatus(), i.getStatus(), null,
                    "Resolution SLA breached (deadline " + i.getResolutionDeadline() + ")"));
        }

        // Early warnings: the deadline is close (by default 80% of the window used) and nothing has happened yet.
        int pct = getWarningPercent();
        for (Incident i : incidents.findByAcknowledgedAtIsNullAndResponseViolatedFalseAndResponseDeadlineAfter(now)) {
            if (Boolean.TRUE.equals(i.getResponseWarned()) || !atRisk(i.getCreatedAt(), i.getResponseDeadline(), now, pct)) continue;
            i.setResponseWarned(true);
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESPONSE_WARNING", i.getStatus(), i.getStatus(), null,
                    "Response SLA at risk: " + timeLeft(now, i.getResponseDeadline()) + " left to acknowledge (deadline " + i.getResponseDeadline() + ")"));
        }
        for (Incident i : incidents.findByResolvedAtIsNullAndResolutionViolatedFalseAndResolutionDeadlineAfter(now)) {
            if (Boolean.TRUE.equals(i.getResolutionWarned()) || !atRisk(i.getCreatedAt(), i.getResolutionDeadline(), now, pct)) continue;
            i.setResolutionWarned(true);
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESOLUTION_WARNING", i.getStatus(), i.getStatus(), null,
                    "Resolution SLA at risk: " + timeLeft(now, i.getResolutionDeadline()) + " left to resolve (deadline " + i.getResolutionDeadline() + ")"));
        }
    }
}
