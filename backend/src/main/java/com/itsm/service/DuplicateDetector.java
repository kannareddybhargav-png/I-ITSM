package com.itsm.service;

import com.itsm.entity.Incident;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Keyword + category/service matching (no machine learning).
 * A candidate is a possible duplicate when it affects the same IT service and shares at least one meaningful keyword,
 * or is in the same category and shares at least two keywords.
 */
@Component
public class DuplicateDetector {
    public record Match(Incident incident, double similarity) {}

    private static final Set<String> STOP = Set.of(
            "the", "and", "for", "with", "not", "are", "was", "has", "have", "this", "that", "from", "can", "cannot", "cant",
            "unable", "issue", "issues", "problem", "problems", "please", "when", "you", "its", "our", "all", "been", "but",
            "any", "too", "get", "got", "still", "again", "very", "working", "work", "error", "since", "after", "what", "will");

    public static Set<String> keywords(String text) {
        Set<String> out = new HashSet<>();
        if (text == null) return out;
        for (String raw : text.toLowerCase().split("[^a-z0-9]+")) {
            String w = raw;
            if (w.length() < 3 || STOP.contains(w)) continue;
            if (w.length() > 3 && w.endsWith("s")) w = w.substring(0, w.length() - 1);
            out.add(w);
        }
        return out;
    }

    public List<Match> findSimilar(Incident created, Collection<Incident> candidates) {
        Set<String> mine = keywords(created.getTitle() + " " + created.getDescription());
        List<Match> out = new ArrayList<>();
        for (Incident c : candidates) {
            if (Objects.equals(c.getId(), created.getId())) continue;
            boolean sameService = c.getService().getId().equals(created.getService().getId());
            boolean sameCategory = c.getCategory().getId().equals(created.getCategory().getId());
            if (!sameService && !sameCategory) continue;
            Set<String> theirs = keywords(c.getTitle() + " " + c.getDescription());
            Set<String> shared = new HashSet<>(mine);
            shared.retainAll(theirs);
            boolean match = (sameService && shared.size() >= 1) || (sameCategory && shared.size() >= 2);
            if (!match) continue;
            Set<String> union = new HashSet<>(mine);
            union.addAll(theirs);
            out.add(new Match(c, (double) shared.size() / union.size()));
        }
        out.sort((a, b) -> Double.compare(b.similarity(), a.similarity()));
        return out;
    }
}
