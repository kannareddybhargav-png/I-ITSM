package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

@Entity
@Getter @Setter @NoArgsConstructor
public class Incident {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String title;
    @Column(nullable = false, length = 2000)
    private String description;
    @ManyToOne(optional = false) private Category category;
    @ManyToOne(optional = false) private ItService service;
    private int affectedUsers = 1;
    private int impact;
    private int urgency;
    private int score;
    @Enumerated(EnumType.STRING) private Priority priority;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private IncidentStatus status = IncidentStatus.NEW;
    @ManyToOne(optional = false) private User reporter;
    @ManyToOne private User technician;
    private Instant createdAt;
    private Instant acknowledgedAt;
    private Instant resolvedAt;
    private Instant responseDeadline;
    private Instant resolutionDeadline;
    private boolean responseViolated;
    private boolean resolutionViolated;
    @Column(length = 2000)
    private String resolution;
    /** Category criticality weight used when the priority was calculated. */
    private Integer criticality;
    /** Id of the earlier open incident this one looks like (duplicate detection). */
    private Long duplicateOfId;
    private Integer escalationLevel;
}
