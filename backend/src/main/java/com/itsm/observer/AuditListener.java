package com.itsm.observer;

import com.itsm.entity.AuditLog;
import com.itsm.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuditListener {
    private final AuditLogRepository repo;

    @EventListener
    public void on(IncidentEvent e) {
        AuditLog a = new AuditLog();
        a.setIncidentId(e.incident().getId());
        a.setActor(e.actor() == null ? "SYSTEM" : e.actor().getName() + " (" + e.actor().getRole() + ")");
        a.setAction(e.action());
        a.setOldStatus(e.oldStatus() == null ? null : e.oldStatus().name());
        a.setNewStatus(e.newStatus() == null ? null : e.newStatus().name());
        a.setDescription(e.description());
        repo.save(a);
    }
}
