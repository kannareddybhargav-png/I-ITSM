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
    Optional<Incident> findFirstByReporterIdAndTitleAndDescriptionAndCreatedAtAfter(Long reporterId, String title, String description, Instant since);
    List<Incident> findByAcknowledgedAtIsNullAndPriorityInAndStatusIn(Collection<Priority> priorities, Collection<IncidentStatus> statuses);
}
