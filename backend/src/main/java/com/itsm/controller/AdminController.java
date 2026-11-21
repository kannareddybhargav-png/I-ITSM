package com.itsm.controller;

import com.itsm.dto.Dtos.*;
import com.itsm.entity.*;
import com.itsm.exception.ApiException;
import com.itsm.repository.*;
import com.itsm.service.AssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/** Users, technicians, reference data, SLA policies and assignment configuration. */
@RestController
@RequiredArgsConstructor
public class AdminController {
    private final UserRepository users;
    private final CategoryRepository categories;
    private final ItServiceRepository services;
    private final SlaPolicyRepository policies;
    private final IncidentRepository incidents;
    private final AssignmentService assignment;
    private final PasswordEncoder encoder;
    private final NotificationRepository notifications;

    // ----- users & technicians -----
    @GetMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserDto> users() { return users.findAll(Sort.by("id")).stream().map(UserDto::from).toList(); }

    @PostMapping("/api/users")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto createUser(@Valid @RequestBody CreateUserRequest r) {
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        User u = new User(r.name().trim(), email, encoder.encode(r.password()), r.role());
        if (r.skills() != null) u.setSkills(new HashSet<>(r.skills()));
        return UserDto.from(users.save(u));
    }

    @PutMapping("/api/users/{id}/technician")
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto updateTechnician(@PathVariable Long id, @RequestBody TechUpdateRequest r) {
        User u = users.findById(id).filter(x -> x.getRole() == Role.TECHNICIAN)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Technician not found"));
        if (r.available() != null) u.setAvailable(r.available());
        if (r.skills() != null) u.setSkills(new HashSet<>(r.skills()));
        return UserDto.from(users.save(u));
    }

    @PutMapping("/api/users/{id}/verified")
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto setVerified(@PathVariable Long id, @RequestBody VerifiedRequest r) {
        User u = users.findById(id).filter(x -> x.getRole() == Role.EMPLOYEE)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
        boolean was = u.isVerified();
        u.setVerified(r.verified());
        if (r.verified()) {
            u.setEmailVerified(true);
            u.setVerificationToken(null);
            u.setVerificationExpiresAt(null);
        }
        users.save(u);
        if (!was && r.verified()) {
            Notification n = new Notification();
            n.setUser(u);
            n.setType("ACCOUNT_VERIFIED");
            n.setMessage("Your account has been verified. You can now report incidents.");
            notifications.save(n);
        }
        return UserDto.from(u);
    }

    @GetMapping("/api/technicians")
    @PreAuthorize("hasRole('ADMIN')")
    public List<TechnicianDto> technicians() {
        return users.findByRole(Role.TECHNICIAN).stream()
                .map(u -> new TechnicianDto(u.getId(), u.getName(), u.getEmail(), u.isAvailable(),
                        new HashSet<>(u.getSkills()), assignment.workload(u.getId()))).toList();
    }

    // ----- categories & services -----
    @GetMapping("/api/categories")
    public List<Category> categories() { return categories.findAll(Sort.by("name")); }

    @PostMapping("/api/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public Category addCategory(@Valid @RequestBody CategoryRequest r) {
        if (categories.existsByNameIgnoreCase(r.name().trim())) throw new ApiException(HttpStatus.CONFLICT, "Category already exists");
        return categories.save(new Category(r.name().trim(), r.criticality()));
    }

    @GetMapping("/api/services")
    public List<ItService> services() { return services.findAll(Sort.by("name")); }

    @PostMapping("/api/services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ItService addService(@Valid @RequestBody ServiceRequest r) {
        if (services.existsByNameIgnoreCase(r.name().trim())) throw new ApiException(HttpStatus.CONFLICT, "Service already exists");
        return services.save(new ItService(r.name().trim(), r.criticality()));
    }

    @PutMapping("/api/categories/{id}/weight")
    @PreAuthorize("hasRole('ADMIN')")
    public Category categoryWeight(@PathVariable Long id, @Valid @RequestBody WeightRequest r) {
        Category c = categories.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
        c.setCriticality(r.weight());
        return categories.save(c);
    }

    @PutMapping("/api/services/{id}/weight")
    @PreAuthorize("hasRole('ADMIN')")
    public ItService serviceWeight(@PathVariable Long id, @Valid @RequestBody WeightRequest r) {
        ItService s = services.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Service not found"));
        s.setCriticality(r.weight());
        return services.save(s);
    }

    // ----- SLA -----
    @GetMapping("/api/sla/policies")
    public List<SlaPolicy> slaPolicies() { return policies.findAll(Sort.by("priority")); }

    @PutMapping("/api/sla/policies/{priority}")
    @PreAuthorize("hasRole('ADMIN')")
    public SlaPolicy updatePolicy(@PathVariable Priority priority, @Valid @RequestBody SlaUpdateRequest r) {
        SlaPolicy p = policies.findById(priority).orElse(new SlaPolicy(priority, r.responseMinutes(), r.resolutionMinutes()));
        p.setResponseMinutes(r.responseMinutes());
        p.setResolutionMinutes(r.resolutionMinutes());
        return policies.save(p);
    }

    @GetMapping("/api/sla/violations")
    @PreAuthorize("hasRole('ADMIN')")
    public List<IncidentDto> violations() {
        return incidents.findByResponseViolatedTrueOrResolutionViolatedTrueOrderByCreatedAtDesc().stream().map(IncidentDto::from).toList();
    }

    // ----- assignment strategy -----
    @GetMapping("/api/config/assignment-strategy")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> strategy() { return Map.of("active", assignment.getActive(), "options", assignment.options()); }

    @PutMapping("/api/config/assignment-strategy")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> setStrategy(@Valid @RequestBody StrategyRequest r) {
        assignment.setActive(r.strategy());
        return strategy();
    }
}
