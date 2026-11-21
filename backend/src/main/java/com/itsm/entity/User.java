package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false, unique = true)
    private String email;
    @Column(nullable = false)
    private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Role role;
    private boolean available = true;
    /** For technicians: names of the incident categories they can handle. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "technician_skills", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "skill")
    private Set<String> skills = new HashSet<>();
    /**
     * Administrator verification of employees. null (accounts that existed before this feature) or true = verified.
     * Self-registered employees start as false and cannot report incidents until an administrator verifies them.
     */
    private Boolean verified = true;

    /** Email address confirmation. null (accounts created before this existed) or true = confirmed; false = link not clicked yet. */
    private Boolean emailVerified;
    private String verificationToken;
    private Instant verificationExpiresAt;

    public boolean isEmailConfirmed() { return emailVerified == null || emailVerified; }

    public boolean isVerified() { return verified == null || verified; }

    public User(String name, String email, String passwordHash, Role role) {
        this.name = name; this.email = email; this.passwordHash = passwordHash; this.role = role;
    }

    public boolean hasSkill(String skill) {
        return skills.stream().anyMatch(s -> s.equalsIgnoreCase(skill));
    }
}
