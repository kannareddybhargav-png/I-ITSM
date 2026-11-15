package com.itsm.observer;

import com.itsm.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Notification mechanism 2: simulated email (the assignment allows simulation). Visible in the server log. */
@Component
public class SimulatedEmailChannel implements NotificationChannel {
    private static final Logger log = LoggerFactory.getLogger(SimulatedEmailChannel.class);

    @Override
    public void send(User recipient, String type, String message) {
        log.info("[SIMULATED EMAIL] to={} subject=[{}] body={}", recipient.getEmail(), type, message);
    }
}
