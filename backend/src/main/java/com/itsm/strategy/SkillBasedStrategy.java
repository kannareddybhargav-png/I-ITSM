package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.User;
import org.springframework.stereotype.Component;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Picks an available technician whose skills include the incident category (ties: lowest workload). */
@Component
public class SkillBasedStrategy implements AssignmentStrategy {
    @Override public String key() { return "SKILL_BASED"; }
    @Override
    public Optional<User> select(Incident i, List<User> available, Map<Long, Long> load) {
        String category = i.getCategory().getName();
        return available.stream().filter(u -> u.hasSkill(category))
                .min(Comparator.comparingLong(u -> load.getOrDefault(u.getId(), 0L)));
    }
}
