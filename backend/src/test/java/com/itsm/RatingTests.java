package com.itsm;

import com.itsm.service.RatingService;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class RatingTests {
    @Test void newTechnicianStartsAtTheInitialRating() {
        RatingService.Rating r = RatingService.compute(List.of(), 0, 4.0, 0.25);
        assertEquals(4.0, r.score());
        assertEquals(0, r.reviews());
    }
    @Test void ratingIsTheAverageIncludingTheInitialRating() {
        assertEquals(4.67, RatingService.compute(List.of(5, 5), 0, 4.0, 0.25).score());
    }
    @Test void eachSlaViolationCostsTheConfiguredPenalty() {
        assertEquals(3.5, RatingService.compute(List.of(), 2, 4.0, 0.25).score());
    }
    @Test void ratingNeverDropsBelowOne() {
        assertEquals(1.0, RatingService.compute(List.of(1, 1, 1), 40, 4.0, 0.25).score());
    }
    @Test void ratingNeverExceedsFive() {
        assertEquals(5.0, RatingService.compute(List.of(5, 5, 5, 5), 0, 5.0, 0.25).score());
    }
}
