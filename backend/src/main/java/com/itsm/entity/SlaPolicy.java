package com.itsm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
public class SlaPolicy {
    @Id @Enumerated(EnumType.STRING)
    private Priority priority;
    private int responseMinutes;
    private int resolutionMinutes;
    public SlaPolicy(Priority p, int response, int resolution) {
        this.priority = p; this.responseMinutes = response; this.resolutionMinutes = resolution;
    }
}
