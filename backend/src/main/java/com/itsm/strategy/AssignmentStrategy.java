package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.User;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AssignmentStrategy {
    String key();
    /** @param available available technicians; @param load technicianId -> active incident count */
    Optional<User> select(Incident incident, List<User> available, Map<Long, Long> load);
}
