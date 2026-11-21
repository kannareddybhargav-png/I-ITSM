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
    /** Base number of the reference. Originals use their own id; duplicates share the number of the incident they duplicate. */
    private Long refNumber;
    /** 1, 2, 3... for the duplicates of one original (shown as -D1, -D2...); null for an original incident. */
    private Integer duplicateSeq;

    /** Star rating (1-5) the reporter gave when confirming the resolution, with an optional written comment. */
    private Integer rating;
    @Column(length = 1000)
    private String feedback;
    private Instant ratedAt;
    /** Technician who was assigned when a response / resolution SLA was breached (used for the technician rating penalty). */
    private Long responseBreachTechnicianId;
    private Long resolutionBreachTechnicianId;

    /** Human-readable reference, e.g. INC-P1-0008 for an original and INC-P3-0003-D1 for its first duplicate. */
    public String getReference() {
        long base = refNumber != null ? refNumber : (duplicateOfId != null ? duplicateOfId : (id == null ? 0 : id));
        String p = priority == null ? "P0" : priority.name();
        String ref = String.format("INC-%s-%04d", p, base);
        return duplicateSeq != null ? ref + "-D" + duplicateSeq : ref;
    }
}
