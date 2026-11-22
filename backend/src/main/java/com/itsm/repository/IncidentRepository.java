package com.itsm.repository;

import com.itsm.entity.Incident;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.Priority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface IncidentRepository extends JpaRepository<Incident, Long>, JpaSpecificationExecutor<Incident> {
    long countByTechnicianIdAndStatusIn(Long technicianId, Collection<IncidentStatus> statuses);
    List<Incident> findByResponseViolatedFalseAndAcknowledgedAtIsNullAndResponseDeadlineBefore(Instant now);
    List<Incident> findByResolutionViolatedFalseAndResolvedAtIsNullAndResolutionDeadlineBefore(Instant now);
    List<Incident> findByResponseViolatedTrueOrResolutionViolatedTrueOrderByCreatedAtDesc();
    List<Incident> findByStatusNotInAndCreatedAtAfter(Collection<IncidentStatus> statuses, Instant since);
    List<Incident> findByDuplicateOfId(Long duplicateOfId);
    List<Incident> findByTechnicianIdAndRatingNotNull(Long technicianId);
    long countByResponseBreachTechnicianId(Long technicianId);
    long countByResolutionBreachTechnicianId(Long technicianId);
    // Breaches flagged before they were attributed to anyone (older rows, or flagged while unassigned) count for the current technician.
    long countByTechnicianIdAndResponseViolatedTrueAndResponseBreachTechnicianIdIsNull(Long technicianId);
    long countByTechnicianIdAndResolutionViolatedTrueAndResolutionBreachTechnicianIdIsNull(Long technicianId);
    // Deadlines that have passed but the 30-second SLA monitor has not flagged yet.
    long countByTechnicianIdAndResponseViolatedFalseAndAcknowledgedAtIsNullAndResponseDeadlineBefore(Long technicianId, Instant now);
    long countByTechnicianIdAndResolutionViolatedFalseAndResolvedAtIsNullAndResolutionDeadlineBefore(Long technicianId, Instant now);
    long countByRefNumberAndDuplicateSeqNotNull(Long refNumber);
    List<Incident> findByRefNumberIsNullOrderByIdAsc();
    Optional<Incident> findFirstByReporterIdAndTitleAndDescriptionAndCreatedAtAfter(Long reporterId, String title, String description, Instant since);
    // Open deadlines that have not passed yet (checked for the early SLA warning).
    List<Incident> findByAcknowledgedAtIsNullAndResponseViolatedFalseAndResponseDeadlineAfter(Instant now);
    List<Incident> findByResolvedAtIsNullAndResolutionViolatedFalseAndResolutionDeadlineAfter(Instant now);
    List<Incident> findByAcknowledgedAtIsNullAndPriorityInAndStatusIn(Collection<Priority> priorities, Collection<IncidentStatus> statuses);
}
