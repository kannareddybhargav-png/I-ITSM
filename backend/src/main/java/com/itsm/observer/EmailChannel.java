package com.itsm.observer;

import com.itsm.entity.User;
import com.itsm.service.MailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Notification mechanism 2: email. Real SMTP when MAIL_HOST is configured, otherwise logged (simulated). */
@Component
@RequiredArgsConstructor
public class EmailChannel implements NotificationChannel {
    private static final java.util.Map<String, String> SUBJECTS = java.util.Map.of(
            "INCIDENT_CREATED", "Incident received",
            "CRITICAL_INCIDENT", "Critical (P1) incident reported",
            "ASSIGNED", "Incident assigned",
            "ACKNOWLEDGED", "Incident acknowledged",
            "RESOLVED", "Incident resolved - please verify",
            "CLOSED", "Incident closed",
            "SLA_VIOLATION", "SLA breached",
            "DUPLICATE_DETECTED", "Possible duplicate incident",
            "ESCALATION", "Incident escalated");

    private final MailService mail;

    @Override
    public void send(User recipient, String type, String message) {
        String subject = "[I-ITSM] " + SUBJECTS.getOrDefault(type, type);
        String body = "Hello " + recipient.getName() + ",\n\n" + message
                + "\n\nOpen the I-ITSM Service Desk for details.\n\nThis is an automatic message, please do not reply.";
        mail.send(recipient.getEmail(), subject, body);
    }
}
