package com.itsm.service;

import com.itsm.entity.Incident;
import com.itsm.entity.SlaPolicy;
import com.itsm.exception.ApiException;
import com.itsm.observer.IncidentEvent;
import com.itsm.repository.IncidentRepository;
import com.itsm.repository.SlaPolicyRepository;
import lombok.RequiredArgsConstructor;
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

    public void applyDeadlines(Incident i) {
        SlaPolicy p = policies.findById(i.getPriority()).orElseThrow(() ->
                new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Missing SLA configuration for " + i.getPriority()));
        i.setResponseDeadline(i.getCreatedAt().plus(Duration.ofMinutes(p.getResponseMinutes())));
        i.setResolutionDeadline(i.getCreatedAt().plus(Duration.ofMinutes(p.getResolutionMinutes())));
    }

    /** Called by the scheduler: flags and announces newly breached deadlines. */
    @Transactional
    public void checkViolations() {
        Instant now = Instant.now();
        for (Incident i : incidents.findByResponseViolatedFalseAndAcknowledgedAtIsNullAndResponseDeadlineBefore(now)) {
            i.setResponseViolated(true);
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESPONSE_VIOLATION", i.getStatus(), i.getStatus(), null,
                    "Response SLA breached (deadline " + i.getResponseDeadline() + ")"));
        }
        for (Incident i : incidents.findByResolutionViolatedFalseAndResolvedAtIsNullAndResolutionDeadlineBefore(now)) {
            i.setResolutionViolated(true);
            incidents.save(i);
            events.publishEvent(new IncidentEvent(i, "SLA_RESOLUTION_VIOLATION", i.getStatus(), i.getStatus(), null,
                    "Resolution SLA breached (deadline " + i.getResolutionDeadline() + ")"));
        }
    }
}
