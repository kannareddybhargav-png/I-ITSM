package com.itsm.controller;

import com.itsm.dto.Dtos.NotificationDto;
import com.itsm.entity.User;
import com.itsm.exception.ApiException;
import com.itsm.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationRepository repo;

    @GetMapping
    public List<NotificationDto> mine(@AuthenticationPrincipal User me) {
        return repo.findByUserIdOrderByCreatedAtDesc(me.getId()).stream().map(NotificationDto::from).toList();
    }

    @PostMapping("/{id}/read")
    public NotificationDto read(@PathVariable Long id, @AuthenticationPrincipal User me) {
        var n = repo.findById(id).filter(x -> x.getUser().getId().equals(me.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found"));
        n.setSeen(true);
        return NotificationDto.from(repo.save(n));
    }
}
