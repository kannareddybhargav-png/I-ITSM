package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;
import org.springframework.stereotype.Component;

/**
 * Score = impact (1-5) x urgency (1-5) x service criticality (1-5), range 1..125.
 * Thresholds: P1 >= 75, P2 >= 40, P3 >= 15, otherwise P4.
 */
@Component
public class ScorePriorityStrategy implements PriorityStrategy {
    @Override
    public int score(Incident i) {
        return i.getImpact() * i.getUrgency() * i.getService().getCriticality();
    }
    @Override
    public Priority classify(int score) {
        if (score >= 75) return Priority.P1;
        if (score >= 40) return Priority.P2;
        if (score >= 15) return Priority.P3;
        return Priority.P4;
    }
}
