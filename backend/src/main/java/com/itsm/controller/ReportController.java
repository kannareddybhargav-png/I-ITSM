package com.itsm.controller;

import com.itsm.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Reports and analytics for administrators (incident overview, service analysis, workload). */
@RestController
@RequiredArgsConstructor
public class ReportController {
    private final ReportService reports;

    @GetMapping("/api/reports/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ReportService.Summary summary() { return reports.summary(); }
}
