package com.itsm;

import com.itsm.entity.*;
import com.itsm.service.DuplicateDetector;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class DuplicateDetectorTests {
    private final DuplicateDetector detector = new DuplicateDetector();

    private Incident inc(long id, String title, long serviceId, long categoryId) {
        Incident i = new Incident();
        i.setId(id);
        i.setTitle(title);
        i.setDescription("");
        ItService s = new ItService("svc", 3);
        s.setId(serviceId);
        i.setService(s);
        Category c = new Category("cat");
        c.setId(categoryId);
        i.setCategory(c);
        return i;
    }

    @Test void paymentExamplesFromTheBriefAreFlagged() {
        Incident a = inc(101, "Payment application unavailable", 1, 1);
        Incident b = inc(102, "Unable to complete payment", 1, 1);
        Incident c = inc(103, "Payment transaction failing", 1, 1);
        assertEquals(2, detector.findSimilar(c, List.of(a, b)).size());
    }
    @Test void incidentIsNotMatchedAgainstItself() {
        Incident a = inc(1, "VPN connection drops", 2, 2);
        assertTrue(detector.findSimilar(a, List.of(a)).isEmpty());
    }
    @Test void sameServiceWithoutSharedKeywordIsNotADuplicate() {
        assertTrue(detector.findSimilar(inc(2, "Printer jammed", 3, 3), List.of(inc(1, "Invoice totals wrong", 3, 3))).isEmpty());
    }
    @Test void differentServiceAndCategoryIsNeverADuplicate() {
        assertTrue(detector.findSimilar(inc(2, "Payment failing", 1, 1), List.of(inc(1, "Payment failing", 9, 9))).isEmpty());
    }
    @Test void sameCategoryDifferentServiceNeedsTwoSharedKeywords() {
        Incident original = inc(1, "VPN login failing", 5, 2);
        assertTrue(detector.findSimilar(inc(2, "Email login broken", 6, 2), List.of(original)).isEmpty());
        assertEquals(1, detector.findSimilar(inc(3, "Cannot login to VPN client", 6, 2), List.of(original)).size());
    }
}
