package com.itsm;

import com.itsm.entity.*;
import com.itsm.strategy.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class CoreLogicTests {
    private final ScorePriorityStrategy priority = new ScorePriorityStrategy();

    private Incident incident(int impact, int urgency, int criticality, String category) {
        Incident i = new Incident();
        i.setImpact(impact);
        i.setUrgency(urgency);
        i.setService(new ItService("svc", criticality));
        i.setCategory(new Category(category));
        return i;
    }
    private User tech(long id, String name, String... skills) {
        User u = new User(name, name + "@x.com", "h", Role.TECHNICIAN);
        u.setId(id);
        u.getSkills().addAll(List.of(skills));
        return u;
    }

    @Test void scoreIsImpactTimesUrgencyTimesCriticality() { assertEquals(100, priority.score(incident(4, 5, 5, "Network"))); }
    @Test void highestScoreIsP1() { assertEquals(Priority.P1, priority.classify(125)); }
    @Test void thresholdsMapToExpectedPriorities() {
        assertEquals(Priority.P2, priority.classify(40));
        assertEquals(Priority.P3, priority.classify(15));
        assertEquals(Priority.P4, priority.classify(14));
    }
    @Test void newIncidentCannotBeClosedDirectly() { assertFalse(IncidentStatus.NEW.canMoveTo(IncidentStatus.CLOSED)); }
    @Test void closedIsTerminal() {
        for (IncidentStatus s : IncidentStatus.values()) assertFalse(IncidentStatus.CLOSED.canMoveTo(s));
    }
    @Test void happyPathTransitionsAreAllowed() {
        IncidentStatus[] path = {IncidentStatus.NEW, IncidentStatus.CLASSIFIED, IncidentStatus.PRIORITIZED, IncidentStatus.ASSIGNED,
                IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.VERIFIED, IncidentStatus.CLOSED};
        for (int k = 0; k < path.length - 1; k++) assertTrue(path[k].canMoveTo(path[k + 1]), path[k] + " -> " + path[k + 1]);
    }
    @Test void closedCannotBeReopenedToInProgress() { assertFalse(IncidentStatus.CLOSED.canMoveTo(IncidentStatus.IN_PROGRESS)); }
    @Test void skillBasedPicksMatchingTechnicianWithLowestLoad() {
        User a = tech(1, "a", "Network"), b = tech(2, "b", "Network"), c = tech(3, "c", "Email");
        var chosen = new SkillBasedStrategy().select(incident(3, 3, 3, "Network"), List.of(a, b, c), Map.of(1L, 4L, 2L, 1L, 3L, 0L));
        assertEquals(2L, chosen.orElseThrow().getId());
    }
    @Test void skillBasedReturnsEmptyWhenNobodyHasTheSkill() {
        assertTrue(new SkillBasedStrategy().select(incident(3, 3, 3, "Database"), List.of(tech(1, "a", "Network")), Map.of()).isEmpty());
    }
    @Test void loadBasedPicksLeastLoadedTechnician() {
        User a = tech(1, "a", "Network"), b = tech(2, "b", "Email");
        var chosen = new LoadBasedStrategy().select(incident(3, 3, 3, "Network"), List.of(a, b), Map.of(1L, 3L, 2L, 0L));
        assertEquals(2L, chosen.orElseThrow().getId());
    }
}
