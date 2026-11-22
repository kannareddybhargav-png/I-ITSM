package com.itsm.observer;

import com.itsm.entity.User;
import com.itsm.service.MailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Notification mechanism 2: real email over SMTP. Active only when MAIL_HOST is configured; otherwise SimulatedEmailChannel takes over. */
@Component
@RequiredArgsConstructor
public class EmailChannel implements NotificationChannel {
    private static final java.util.Map<String, String> SUBJECTS = java.util.Map.ofEntries(
            java.util.Map.entry("INCIDENT_CREATED", "Incident received"),
            java.util.Map.entry("CRITICAL_INCIDENT", "Critical (P1) incident reported"),
            java.util.Map.entry("ASSIGNED", "Incident assigned"),
            java.util.Map.entry("ACKNOWLEDGED", "Incident acknowledged"),
            java.util.Map.entry("RESOLVED", "Incident resolved - please verify"),
            java.util.Map.entry("CLOSED", "Incident closed"),
            java.util.Map.entry("SLA_VIOLATION", "SLA breached"),
            java.util.Map.entry("SLA_WARNING", "SLA deadline approaching"),
            java.util.Map.entry("DUPLICATE_DETECTED", "Possible duplicate incident"),
            java.util.Map.entry("ESCALATION", "Incident escalated"),
            java.util.Map.entry("INCIDENT_UPDATED", "Incident updated"),
            java.util.Map.entry("INFO_REQUESTED", "More information needed"),
            java.util.Map.entry("INFO_PROVIDED", "Information added"),
            java.util.Map.entry("INCIDENT_VERIFIED", "Incident confirmed as fixed"));

    private final MailService mail;

    @Override
    public void send(User recipient, String type, String message) {
        if (!mail.isEnabled()) return; // no mail server: SimulatedEmailChannel logs the email instead
        String subject = "[I-ITSM] " + SUBJECTS.getOrDefault(type, type);
        String body = "Hello " + recipient.getName() + ",\n\n" + message
                + "\n\nOpen the I-ITSM Service Desk for details.\n\nThis is an automatic message, please do not reply.";
        mail.send(recipient.getEmail(), subject, body);
    }
}
