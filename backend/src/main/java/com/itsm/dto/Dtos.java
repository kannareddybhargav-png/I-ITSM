package com.itsm.dto;

import com.itsm.entity.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public final class Dtos {
    private Dtos() {}

    public record RegisterRequest(@NotBlank String name, @NotBlank @Email String email, @NotBlank @Size(min = 6) String password) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record AuthResponse(String token, UserDto user) {}

    public record UserDto(Long id, String name, String email, Role role, boolean available, Set<String> skills) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isAvailable(), new HashSet<>(u.getSkills()));
        }
    }
    public record CreateUserRequest(@NotBlank String name, @NotBlank @Email String email,
                                    @NotBlank @Size(min = 6) String password, @NotNull Role role, Set<String> skills) {}
    public record TechUpdateRequest(Boolean available, Set<String> skills) {}
    public record TechnicianDto(Long id, String name, String email, boolean available, Set<String> skills, long activeIncidents) {}

    public record CreateIncidentRequest(@NotBlank @Size(max = 200) String title,
                                        @NotBlank @Size(max = 2000) String description,
                                        @NotNull Long categoryId, @NotNull Long serviceId,
                                        @Min(1) @Max(5) int urgency) {}
    public record UpdateIncidentRequest(@NotBlank @Size(max = 200) String title,
                                        @NotBlank @Size(max = 2000) String description,
                                        @Min(1) @Max(5) int urgency) {}
    public record TextRequest(@NotBlank @Size(max = 2000) String text) {}
    public record AssignRequest(Long technicianId) {}
    public record CategoryRequest(@NotBlank String name, @Min(1) @Max(5) int criticality) {}
    public record WeightRequest(@Min(1) @Max(5) int weight) {}
    public record ServiceRequest(@NotBlank String name, @Min(1) @Max(5) int criticality) {}
    public record SlaUpdateRequest(@Min(1) int responseMinutes, @Min(1) int resolutionMinutes) {}
    public record StrategyRequest(@NotBlank String strategy) {}

    public record AuditDto(String action, String actor, String oldStatus, String newStatus, String description, Instant timestamp) {
        public static AuditDto from(AuditLog a) {
            return new AuditDto(a.getAction(), a.getActor(), a.getOldStatus(), a.getNewStatus(), a.getDescription(), a.getTimestamp());
        }
    }
    public record NotificationDto(Long id, String type, String message, boolean seen, Instant createdAt) {
        public static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getMessage(), n.isSeen(), n.getCreatedAt());
        }
    }

    public record IncidentDto(Long id, String title, String description, Long categoryId, String category,
                              Long serviceId, String service, int impact, int urgency, Integer criticality, int score,
                              Priority priority, IncidentStatus status, Long reporterId, String reporter,
                              Long technicianId, String technician, Instant createdAt, Instant acknowledgedAt,
                              Instant resolvedAt, Instant responseDeadline, Instant resolutionDeadline,
                              boolean responseViolated, boolean resolutionViolated, String resolution,
                              Long duplicateOfId, int escalationLevel) {
        /** Technicians see the priority but not how it was calculated (impact, criticality, urgency, score). */
        public IncidentDto forRole(Role role) {
            if (role != Role.TECHNICIAN) return this;
            return new IncidentDto(id, title, description, categoryId, category, serviceId, service, 0, 0, null, 0,
                    priority, status, reporterId, reporter, technicianId, technician, createdAt, acknowledgedAt,
                    resolvedAt, responseDeadline, resolutionDeadline, responseViolated, resolutionViolated, resolution,
                    duplicateOfId, escalationLevel);
        }

        public static IncidentDto from(Incident i) {
            User t = i.getTechnician();
            return new IncidentDto(i.getId(), i.getTitle(), i.getDescription(),
                    i.getCategory().getId(), i.getCategory().getName(), i.getService().getId(), i.getService().getName(),
                    i.getImpact(), i.getUrgency(), i.getCriticality(), i.getScore(), i.getPriority(), i.getStatus(),
                    i.getReporter().getId(), i.getReporter().getName(),
                    t == null ? null : t.getId(), t == null ? null : t.getName(),
                    i.getCreatedAt(), i.getAcknowledgedAt(), i.getResolvedAt(), i.getResponseDeadline(),
                    i.getResolutionDeadline(), i.isResponseViolated(), i.isResolutionViolated(), i.getResolution(),
                    i.getDuplicateOfId(), i.getEscalationLevel() == null ? 0 : i.getEscalationLevel());
        }
    }
}
