package com.itsm.observer;

import com.itsm.entity.User;

public interface NotificationChannel {
    void send(User recipient, String type, String message);
}
