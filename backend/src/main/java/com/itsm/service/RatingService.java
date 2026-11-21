package com.itsm.service;

import com.itsm.entity.Incident;
import com.itsm.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * Technician rating = (initial rating + all star ratings given by employees) / (number of ratings + 1),
 * minus a penalty for every SLA breach that happened while the technician was assigned, kept between 1 and 5.
 * The initial rating counts as one rating, so a single review cannot swing a new technician to an extreme.
 */
@Service
@RequiredArgsConstructor
public class RatingService {
    public record Rating(double score, double average, int reviews, int slaViolations, double penalty, double initial) {}

    private final IncidentRepository incidents;
    @Value("${app.rating.initial}") private double initial;
    @Value("${app.rating.sla-penalty}") private double slaPenalty;

    public Rating forTechnician(Long technicianId) {
        List<Integer> stars = incidents.findByTechnicianIdAndRatingNotNull(technicianId).stream().map(Incident::getRating).toList();
        long violations = incidents.countByResponseBreachTechnicianId(technicianId) + incidents.countByResolutionBreachTechnicianId(technicianId);
        return compute(stars, violations, initial, slaPenalty);
    }

    public static Rating compute(List<Integer> stars, long violations, double initial, double penaltyPerViolation) {
        double sum = initial;
        for (int s : stars) sum += s;
        double average = sum / (stars.size() + 1);
        double penalty = penaltyPerViolation * violations;
        double score = Math.max(1.0, Math.min(5.0, average - penalty));
        return new Rating(round2(score), round2(average), stars.size(), (int) violations, round2(penalty), initial);
    }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
