package com.itsm.repository;

import com.itsm.entity.Priority;
import com.itsm.entity.SlaPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SlaPolicyRepository extends JpaRepository<SlaPolicy, Priority> {}
