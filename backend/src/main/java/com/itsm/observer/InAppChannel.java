package com.itsm.observer;

import com.itsm.entity.Notification;
import com.itsm.entity.User;
import com.itsm.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Notification mechanism 1: stored in the database and shown in the UI bell. */
@Component
@RequiredArgsConstructor
public class InAppChannel implements NotificationChannel {
    private final NotificationRepository repo;

    @Override
    public void send(User recipient, String type, String message) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setType(type);
        n.setMessage(message);
        repo.save(n);
    }
}
