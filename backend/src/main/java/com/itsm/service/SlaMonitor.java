package com.itsm.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SlaMonitor {
    private final SlaService sla;

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    public void run() { sla.checkViolations(); }
}
