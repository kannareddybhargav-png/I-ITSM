package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "it_service")
@Getter @Setter @NoArgsConstructor
public class ItService {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String name;
    /** Impact weight 1 (low) .. 5 (severe) of this service, editable by admins. Used as the incident impact. */
    private int criticality;
    public ItService(String name, int criticality) { this.name = name; this.criticality = criticality; }
}
