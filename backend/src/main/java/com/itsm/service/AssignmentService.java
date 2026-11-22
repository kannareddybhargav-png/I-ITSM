package com.itsm.service;

import com.itsm.entity.AppSetting;
import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.exception.ApiException;
import com.itsm.repository.AppSettingRepository;
import com.itsm.repository.IncidentRepository;
import com.itsm.repository.UserRepository;
import com.itsm.strategy.AssignmentStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

/** Picks a technician with the active strategy. The administrator's choice is stored in the database and survives restarts. */
@Service
public class AssignmentService {
    private static final Logger log = LoggerFactory.getLogger(AssignmentService.class);
    static final String SETTING_KEY = "assignment.strategy";
    private static final List<IncidentStatus> ACTIVE =
            List.of(IncidentStatus.ASSIGNED, IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS);

    private final Map<String, AssignmentStrategy> strategies;
    private final UserRepository users;
    private final IncidentRepository incidents;
    private final AppSettingRepository settings;
    private volatile String active = "SKILL_BASED";

    public AssignmentService(List<AssignmentStrategy> list, UserRepository users, IncidentRepository incidents,
                             AppSettingRepository settings) {
        this.strategies = list.stream().collect(Collectors.toMap(AssignmentStrategy::key, s -> s));
        this.users = users;
        this.incidents = incidents;
        this.settings = settings;
    }

    /** Restores the strategy saved by an administrator; an unknown or missing value keeps the default. */
    @EventListener(ApplicationReadyEvent.class)
    public void loadSavedStrategy() {
        try {
            settings.findById(SETTING_KEY).map(AppSetting::getValue).filter(strategies::containsKey).ifPresent(v -> {
                active = v;
                log.info("Assignment strategy restored from the database: {}", v);
            });
        } catch (RuntimeException e) {
            log.warn("Could not read the saved assignment strategy, using {}: {}", active, e.getMessage());
        }
    }

    public Optional<User> pick(Incident incident) {
        List<User> available = users.findByRoleAndAvailableTrue(Role.TECHNICIAN);
        Map<Long, Long> load = new HashMap<>();
        available.forEach(u -> load.put(u.getId(), workload(u.getId())));
        return strategies.get(active).select(incident, available, load);
    }

    /** Used by escalation: next best technician other than the current one (skill match first, then least loaded). */
    public Optional<User> pickExcluding(Incident incident, Long excludeId) {
        List<User> available = users.findByRoleAndAvailableTrue(Role.TECHNICIAN).stream()
                .filter(u -> !u.getId().equals(excludeId)).toList();
        Map<Long, Long> load = new HashMap<>();
        available.forEach(u -> load.put(u.getId(), workload(u.getId())));
        Optional<User> skilled = strategies.get("SKILL_BASED").select(incident, available, load);
        return skilled.isPresent() ? skilled : strategies.get("LOAD_BASED").select(incident, available, load);
    }

    public long workload(Long technicianId) {
        return incidents.countByTechnicianIdAndStatusIn(technicianId, ACTIVE);
    }

    public String getActive() { return active; }
    public Set<String> options() { return new TreeSet<>(strategies.keySet()); }

    public void setActive(String key) {
        if (!strategies.containsKey(key)) throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown strategy: " + key);
        this.active = key;
        settings.save(new AppSetting(SETTING_KEY, key));
    }
}
