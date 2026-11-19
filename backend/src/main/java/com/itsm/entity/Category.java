package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
public class Category {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String name;
    /** Business criticality weight 1..5, editable by admins. Nullable only for rows created before weights existed. */
    private Integer criticality = 3;

    public Category(String name) { this.name = name; }
    public Category(String name, int criticality) { this.name = name; this.criticality = criticality; }
}
