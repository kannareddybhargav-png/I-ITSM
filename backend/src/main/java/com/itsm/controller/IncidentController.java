package com.itsm.controller;

import com.itsm.dto.Dtos.*;
import com.itsm.entity.IncidentStatus;
import com.itsm.entity.Priority;
import com.itsm.entity.User;
import com.itsm.service.IncidentService;
import com.itsm.service.IncidentService.Filter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {
    private final IncidentService svc;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto create(@Valid @RequestBody CreateIncidentRequest r, @AuthenticationPrincipal User me) {
        return svc.create(r, me);
    }

    @GetMapping
    public List<IncidentDto> search(@RequestParam(required = false) IncidentStatus status,
                                    @RequestParam(required = false) Priority priority,
                                    @RequestParam(required = false) Long categoryId,
                                    @RequestParam(required = false) Long serviceId,
                                    @RequestParam(required = false) Long technicianId,
                                    @RequestParam(required = false) Long reporterId,
                                    @RequestParam(required = false) String q,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false) String scope,
                                    @AuthenticationPrincipal User me) {
        return svc.search(new Filter(status, priority, categoryId, serviceId, technicianId, reporterId, q, from, scope), me);
    }

    @GetMapping("/{id}")
    public IncidentDto get(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.get(id, me); }

    @GetMapping("/{id}/history")
    public List<AuditDto> history(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.history(id, me); }

    @GetMapping("/{id}/related")
    public List<IncidentDto> related(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.related(id, me); }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto update(@PathVariable Long id, @Valid @RequestBody UpdateIncidentRequest r, @AuthenticationPrincipal User me) {
        return svc.update(id, r, me);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal User me) { svc.delete(id, me); }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public IncidentDto assign(@PathVariable Long id, @RequestBody(required = false) AssignRequest r, @AuthenticationPrincipal User me) {
        return svc.assign(id, r == null ? null : r.technicianId(), me);
    }

    @PostMapping("/{id}/acknowledge")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public IncidentDto acknowledge(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.acknowledge(id, me); }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public IncidentDto start(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.start(id, me); }

    @PostMapping("/{id}/notes")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public IncidentDto note(@PathVariable Long id, @Valid @RequestBody TextRequest r, @AuthenticationPrincipal User me) {
        return svc.addNote(id, r.text(), me);
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public IncidentDto resolve(@PathVariable Long id, @Valid @RequestBody TextRequest r, @AuthenticationPrincipal User me) {
        return svc.resolve(id, r.text(), me);
    }

    @PostMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto verify(@PathVariable Long id, @RequestBody(required = false) @Valid FeedbackRequest r, @AuthenticationPrincipal User me) {
        return svc.verify(id, r, me);
    }

    @PostMapping("/{id}/request-info")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public IncidentDto requestInfo(@PathVariable Long id, @Valid @RequestBody TextRequest r, @AuthenticationPrincipal User me) {
        return svc.requestInfo(id, r.text(), me);
    }

    @PostMapping("/{id}/info")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto provideInfo(@PathVariable Long id, @Valid @RequestBody TextRequest r, @AuthenticationPrincipal User me) {
        return svc.provideInfo(id, r.text(), me);
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto reopen(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.reopen(id, me); }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public IncidentDto close(@PathVariable Long id, @AuthenticationPrincipal User me) { return svc.close(id, me); }
}
