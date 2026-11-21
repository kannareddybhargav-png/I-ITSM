package com.itsm.config;

import com.itsm.entity.Incident;
import com.itsm.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gives incidents created before references existed a base number and, for duplicates, a -D sequence.
 * Runs on every start but only touches rows without a reference, oldest first, so originals are numbered before their duplicates.
 */
@Component
@RequiredArgsConstructor
public class ReferenceBackfill implements CommandLineRunner {
    private final IncidentRepository incidents;

    @Override
    @Transactional
    public void run(String... args) {
        for (Incident i : incidents.findByRefNumberIsNullOrderByIdAsc()) {
            if (i.getDuplicateOfId() == null) {
                i.setRefNumber(i.getId());
            } else {
                Long base = incidents.findById(i.getDuplicateOfId())
                        .map(o -> o.getRefNumber() != null ? o.getRefNumber() : o.getId())
                        .orElse(i.getDuplicateOfId());
                i.setRefNumber(base);
                i.setDuplicateSeq((int) incidents.countByRefNumberAndDuplicateSeqNotNull(base) + 1);
            }
            incidents.saveAndFlush(i);
        }
    }
}
