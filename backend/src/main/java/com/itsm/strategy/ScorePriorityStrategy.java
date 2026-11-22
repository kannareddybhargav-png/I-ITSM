package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;
import org.springframework.stereotype.Component;

/**
 * Score = impact (weight of the affected service) x business criticality (weight of the category)
 * x urgency (chosen by the employee). Each factor is 1..5, so the base score is 1..125.
 * The number of affected users then scales it: x1.2 from 10 users, x1.5 from 100 users (capped at 125).
 * Thresholds: P1 >= 75, P2 >= 40, P3 >= 15, otherwise P4.
 */
@Component
public class ScorePriorityStrategy implements PriorityStrategy {
    @Override
    public int score(Incident i) {
        int criticality = i.getCriticality() != null ? i.getCriticality() : 3;
        int base = i.getImpact() * i.getUrgency() * criticality;
        return (int) Math.min(125L, Math.round(base * usersFactor(i.getAffectedUsers())));
    }
    /** 1.0 for fewer than 10 affected users, 1.2 for 10 to 99, 1.5 for 100 or more. */
    public static double usersFactor(int affectedUsers) {
        if (affectedUsers >= 100) return 1.5;
        if (affectedUsers >= 10) return 1.2;
        return 1.0;
    }

    @Override
    public Priority classify(int score) {
        if (score >= 75) return Priority.P1;
        if (score >= 40) return Priority.P2;
        if (score >= 15) return Priority.P3;
        return Priority.P4;
    }
}
