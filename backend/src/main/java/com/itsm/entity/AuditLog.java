package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

/** Append-only: no update or delete operation is exposed anywhere in the application. */
@Entity
@Getter @Setter @NoArgsConstructor
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false) private Long incidentId;
    @Column(updatable = false) private String actor;
    @Column(updatable = false) private String action;
    @Column(updatable = false) private String oldStatus;
    @Column(updatable = false) private String newStatus;
    @Column(updatable = false, length = 2000) private String description;
    @Column(updatable = false) private Instant timestamp = Instant.now();
}
