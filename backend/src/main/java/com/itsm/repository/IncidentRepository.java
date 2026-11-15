package com.itsm.repository;

import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface IncidentRepository extends JpaRepository<Incident, Long>, JpaSpecificationExecutor<Incident> {
    long countByTechnicianIdAndStatusIn(Long technicianId, Collection<IncidentStatus> statuses);
    List<Incident> findByResponseViolatedFalseAndAcknowledgedAtIsNullAndResponseDeadlineBefore(Instant now);
    List<Incident> findByResolutionViolatedFalseAndResolvedAtIsNullAndResolutionDeadlineBefore(Instant now);
    List<Incident> findByResponseViolatedTrueOrResolutionViolatedTrueOrderByCreatedAtDesc();
}
