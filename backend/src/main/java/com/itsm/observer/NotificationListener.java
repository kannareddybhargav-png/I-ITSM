package com.itsm.observer;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class NotificationListener {
    private final List<NotificationChannel> channels;
    private final UserRepository users;

    @EventListener
    public void on(IncidentEvent e) {
        Incident i = e.incident();
        String ref = "Incident " + i.getReference() + " (" + i.getTitle() + ")";
        User tech = i.getTechnician();
        switch (e.action()) {
            case "CREATED" -> send(List.of(i.getReporter()), "INCIDENT_CREATED", ref + " was submitted.");
            case "PRIORITIZED" -> {
                if (i.getPriority() == Priority.P1) send(users.findByRole(Role.ADMIN), "CRITICAL_INCIDENT", ref + " is P1 (critical).");
            }
            case "ASSIGNED", "REASSIGNED" -> {
                if (tech != null) {
                    send(List.of(tech), "ASSIGNED", ref + " has been assigned to you.");
                    send(List.of(i.getReporter()), "ASSIGNED", ref + " was assigned to " + tech.getName() + ".");
                }
            }
            case "ACKNOWLEDGED" -> send(List.of(i.getReporter()), "ACKNOWLEDGED", ref + " was acknowledged by the technician.");
            case "RESOLVED" -> send(List.of(i.getReporter()), "RESOLVED", ref + " was resolved. Please verify the resolution.");
            case "CLOSED" -> { if (tech != null) send(List.of(tech), "CLOSED", ref + " was closed."); }
            case "SLA_RESPONSE_VIOLATION", "SLA_RESOLUTION_VIOLATION" -> {
                List<User> to = new ArrayList<>(users.findByRole(Role.ADMIN));
                if (tech != null) to.add(tech);
                send(to, "SLA_VIOLATION", ref + ": " + e.description());
            }
            case "DUPLICATE_DETECTED" -> send(adminsAnd(tech), "DUPLICATE_DETECTED", ref + ": " + e.description());
            case "ESCALATED_L1", "ESCALATED_L2" -> send(adminsAnd(tech), "ESCALATION", ref + ": " + e.description());
            default -> { }
        }
    }

    private List<User> adminsAnd(User tech) {
        List<User> to = new ArrayList<>(users.findByRole(Role.ADMIN));
        if (tech != null) to.add(tech);
        return to;
    }

    private void send(List<User> recipients, String type, String message) {
        recipients.stream().filter(Objects::nonNull).forEach(u -> channels.forEach(c -> c.send(u, type, message)));
    }
}
