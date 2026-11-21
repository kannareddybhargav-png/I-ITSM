package com.itsm.controller;

import com.itsm.entity.User;
import com.itsm.service.RatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class RatingController {
    private final RatingService ratings;

    /** The signed-in technician's own rating (shown on their dashboard). */
    @GetMapping("/api/ratings/me")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public RatingService.Rating mine(@AuthenticationPrincipal User me) { return ratings.forTechnician(me.getId()); }
}
