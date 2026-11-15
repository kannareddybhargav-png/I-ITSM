package com.itsm.entity;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** State pattern: each state knows which states may follow it. */
public enum IncidentStatus {
    NEW, CLASSIFIED, PRIORITIZED, ASSIGNED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, VERIFIED, CLOSED;

    private static final Map<IncidentStatus, Set<IncidentStatus>> NEXT = new EnumMap<>(IncidentStatus.class);
    static {
        NEXT.put(NEW, EnumSet.of(CLASSIFIED, ASSIGNED));
        NEXT.put(CLASSIFIED, EnumSet.of(PRIORITIZED));
        NEXT.put(PRIORITIZED, EnumSet.of(ASSIGNED));
        NEXT.put(ASSIGNED, EnumSet.of(ACKNOWLEDGED));
        NEXT.put(ACKNOWLEDGED, EnumSet.of(IN_PROGRESS));
        NEXT.put(IN_PROGRESS, EnumSet.of(RESOLVED));
        NEXT.put(RESOLVED, EnumSet.of(VERIFIED, IN_PROGRESS)); // IN_PROGRESS = reopen
        NEXT.put(VERIFIED, EnumSet.of(CLOSED));
        NEXT.put(CLOSED, EnumSet.noneOf(IncidentStatus.class));
    }

    public boolean canMoveTo(IncidentStatus target) {
        return NEXT.get(this).contains(target);
    }
}
