package com.itsm.observer;

import com.itsm.entity.User;
import com.itsm.service.MailService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Notification mechanism 2 (simulated): when no SMTP server is configured, each email is written to the server log
 * instead of being sent (the assignment allows simulation). When MAIL_HOST is set, EmailChannel sends real email and
 * this channel stays silent, so every notification produces exactly one email or one log line.
 */
@Component
@RequiredArgsConstructor
public class SimulatedEmailChannel implements NotificationChannel {
    private static final Logger log = LoggerFactory.getLogger(SimulatedEmailChannel.class);

    private final MailService mail;

    @Override
    public void send(User recipient, String type, String message) {
        if (mail.isEnabled()) return;
        log.info("[SIMULATED EMAIL] to={} subject=[{}] body={}", recipient.getEmail(), type, message);
    }
}
