package com.itsm.observer;

import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.User;

/** Published by the service layer; audit and notification listeners subscribe (Observer pattern). actor == null means SYSTEM. */
public record IncidentEvent(Incident incident, String action, IncidentStatus oldStatus,
                            IncidentStatus newStatus, User actor, String description) {}
