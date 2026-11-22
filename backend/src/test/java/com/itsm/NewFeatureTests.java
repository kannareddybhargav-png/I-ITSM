package com.itsm;

import com.itsm.entity.*;
import com.itsm.service.ReportService;
import com.itsm.service.SlaService;
import com.itsm.strategy.ScorePriorityStrategy;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** SLA early warning, affected-users factor and the reports aggregation. */
class NewFeatureTests {
    private static final Instant T0 = Instant.parse("2026-11-22T10:00:00Z");

    // ---------- SLA early warning ----------
    @Test void notAtRiskBeforeEightyPercent() {
        // 30-minute window, 23 minutes used = 76%
        assertFalse(SlaService.atRisk(T0, T0.plusSeconds(1800), T0.plusSeconds(23 * 60), 80));
    }
    @Test void atRiskFromEightyPercent() {
        assertTrue(SlaService.atRisk(T0, T0.plusSeconds(1800), T0.plusSeconds(24 * 60), 80));
    }
    @Test void passedDeadlineIsAViolationNotAWarning() {
        assertFalse(SlaService.atRisk(T0, T0.plusSeconds(1800), T0.plusSeconds(1801), 80));
    }
    @Test void missingDeadlineIsNeverAtRisk() {
        assertFalse(SlaService.atRisk(T0, null, T0.plusSeconds(10), 80));
    }

    // ---------- affected users ----------
    private Incident incident(int impact, int urgency, int criticality, int users) {
        Incident i = new Incident();
        i.setImpact(impact);
        i.setUrgency(urgency);
        i.setCriticality(criticality);
        i.setAffectedUsers(users);
        return i;
    }
    @Test void usersFactorSteps() {
        assertEquals(1.0, ScorePriorityStrategy.usersFactor(1));
        assertEquals(1.0, ScorePriorityStrategy.usersFactor(9));
        assertEquals(1.2, ScorePriorityStrategy.usersFactor(10));
        assertEquals(1.5, ScorePriorityStrategy.usersFactor(100));
    }
    @Test void manyAffectedUsersRaisePriority() {
        ScorePriorityStrategy p = new ScorePriorityStrategy();
        assertEquals(27, p.score(incident(3, 3, 3, 1)));                 // P3
        assertEquals(41, p.score(incident(3, 3, 3, 100)));               // 27 x 1.5 = 40.5 -> 41, P2
        assertEquals(Priority.P2, p.classify(p.score(incident(3, 3, 3, 100))));
    }
    @Test void scoreIsCappedAt125() {
        assertEquals(125, new ScorePriorityStrategy().score(incident(5, 5, 5, 500)));
    }

    // ---------- reports ----------
    private Incident inc(String service, String category, Priority p, IncidentStatus s, boolean breached) {
        Incident i = new Incident();
        i.setService(new ItService(service, 3));
        i.setCategory(new Category(category, 3));
        i.setPriority(p);
        i.setStatus(s);
        i.setResponseViolated(breached);
        i.setCreatedAt(T0);
        if (s == IncidentStatus.RESOLVED || s == IncidentStatus.CLOSED) i.setResolvedAt(T0.plusSeconds(7200));
        return i;
    }
    @Test void reportCountsPerServiceIncludingEmptyServices() {
        List<Incident> all = List.of(
                inc("Payment Application", "Software", Priority.P1, IncidentStatus.ASSIGNED, true),
                inc("Payment Application", "Software", Priority.P2, IncidentStatus.CLOSED, false),
                inc("VPN", "Network", Priority.P3, IncidentStatus.RESOLVED, false));
        ReportService.Summary s = ReportService.summarize(all, List.of("Payment Application", "VPN", "Printing"),
                List.of("Software", "Network"), T0.plusSeconds(60), 80);
        assertEquals(3, s.overview().total());
        assertEquals(1, s.overview().open());
        assertEquals(1, s.overview().criticalOpen());
        assertEquals(2, s.overview().resolved());
        assertEquals(1, s.overview().breached());
        assertEquals(100.0, s.overview().slaCompliancePercent());
        assertEquals(2.0, s.overview().avgResolutionHours());
        ReportService.Row payment = s.byService().get(0);
        assertEquals("Payment Application", payment.name());
        assertEquals(2, payment.total());
        assertEquals(1, payment.breached());
        assertTrue(s.byService().stream().anyMatch(r -> r.name().equals("Printing") && r.total() == 0));
        assertEquals(1L, s.byStatus().get("ASSIGNED"));
    }
}
