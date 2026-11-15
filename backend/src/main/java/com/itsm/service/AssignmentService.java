package com.itsm.service;

import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.exception.ApiException;
import com.itsm.repository.IncidentRepository;
import com.itsm.repository.UserRepository;
import com.itsm.strategy.AssignmentStrategy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AssignmentService {
    private static final List<IncidentStatus> ACTIVE =
            List.of(IncidentStatus.ASSIGNED, IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS);

    private final Map<String, AssignmentStrategy> strategies;
    private final UserRepository users;
    private final IncidentRepository incidents;
    private volatile String active = "SKILL_BASED";

    public AssignmentService(List<AssignmentStrategy> list, UserRepository users, IncidentRepository incidents) {
        this.strategies = list.stream().collect(Collectors.toMap(AssignmentStrategy::key, s -> s));
        this.users = users;
        this.incidents = incidents;
    }

    public Optional<User> pick(Incident incident) {
        List<User> available = users.findByRoleAndAvailableTrue(Role.TECHNICIAN);
        Map<Long, Long> load = new HashMap<>();
        available.forEach(u -> load.put(u.getId(), workload(u.getId())));
        return strategies.get(active).select(incident, available, load);
    }

    public long workload(Long technicianId) {
        return incidents.countByTechnicianIdAndStatusIn(technicianId, ACTIVE);
    }

    public String getActive() { return active; }
    public Set<String> options() { return new TreeSet<>(strategies.keySet()); }

    public void setActive(String key) {
        if (!strategies.containsKey(key)) throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown strategy: " + key);
        this.active = key;
    }
}
