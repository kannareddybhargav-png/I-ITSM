package com.itsm.strategy;

import com.itsm.entity.Incident;
import com.itsm.entity.Priority;

public interface PriorityStrategy {
    int score(Incident incident);
    Priority classify(int score);
}
