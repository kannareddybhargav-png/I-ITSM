package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;
import org.springframework.stereotype.Component;

/**
 * Score = impact (weight of the affected service) x business criticality (weight of the category)
 * x urgency (chosen by the employee). Each factor is 1..5, so the score is 1..125.
 * Thresholds: P1 >= 75, P2 >= 40, P3 >= 15, otherwise P4.
 */
@Component
public class ScorePriorityStrategy implements PriorityStrategy {
    @Override
    public int score(Incident i) {
        int criticality = i.getCriticality() != null ? i.getCriticality() : 3;
        return i.getImpact() * i.getUrgency() * criticality;
    }
    @Override
    public Priority classify(int score) {
        if (score >= 75) return Priority.P1;
        if (score >= 40) return Priority.P2;
        if (score >= 15) return Priority.P3;
        return Priority.P4;
    }
}
