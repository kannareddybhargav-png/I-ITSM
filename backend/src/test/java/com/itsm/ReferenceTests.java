package com.itsm;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ReferenceTests {
    private Incident incident(long id, Priority p, Long refNumber, Integer dupSeq) {
        Incident i = new Incident();
        i.setId(id);
        i.setPriority(p);
        i.setRefNumber(refNumber);
        i.setDuplicateSeq(dupSeq);
        return i;
    }

    @Test
    void originalUsesOwnNumberAndPriority() {
        assertEquals("INC-P1-0008", incident(8, Priority.P1, 8L, null).getReference());
    }

    @Test
    void duplicateSharesBaseNumberOfOriginal() {
        assertEquals("INC-P3-0003-D1", incident(7, Priority.P3, 3L, 1).getReference());
        assertEquals("INC-P2-0003-D2", incident(9, Priority.P2, 3L, 2).getReference());
    }
}
