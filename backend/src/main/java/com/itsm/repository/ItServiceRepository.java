package com.itsm.repository;

import com.itsm.entity.ItService;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItServiceRepository extends JpaRepository<ItService, Long> {
    boolean existsByNameIgnoreCase(String name);
}
