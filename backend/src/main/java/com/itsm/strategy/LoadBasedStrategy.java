package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.User;
import org.springframework.stereotype.Component;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Picks the available technician with the fewest active incidents, regardless of skills. */
@Component
public class LoadBasedStrategy implements AssignmentStrategy {
    @Override public String key() { return "LOAD_BASED"; }
    @Override
    public Optional<User> select(Incident i, List<User> available, Map<Long, Long> load) {
        return available.stream().min(Comparator.comparingLong(u -> load.getOrDefault(u.getId(), 0L)));
    }
}
