package com.itsm.config;

import com.itsm.entity.*;
import com.itsm.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;

/**
 * Seeds reference data (categories, services, SLA policies), makes sure at least one administrator exists
 * (credentials from ADMIN_EMAIL / ADMIN_PASSWORD), and optionally creates demo users.
 */
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private static final Map<String, Integer> DEFAULT_WEIGHTS = Map.of(
            "Network", 4, "Hardware", 3, "Software", 3, "Email", 2, "Security & Access", 5, "Database", 4);

    private final UserRepository users;
    private final CategoryRepository categories;
    private final ItServiceRepository services;
    private final SlaPolicyRepository sla;
    private final PasswordEncoder encoder;
    @Value("${app.seed-demo-users}") private boolean seedDemoUsers;
    @Value("${app.admin.email}") private String adminEmail;
    @Value("${app.admin.password}") private String adminPassword;

    @Override
    public void run(String... args) {
        if (categories.count() == 0) {
            DEFAULT_WEIGHTS.forEach((name, w) -> categories.save(new Category(name, w)));
        }
        // Categories created before weights existed get a default weight.
        for (Category c : categories.findAll()) {
            if (c.getCriticality() == null) {
                c.setCriticality(DEFAULT_WEIGHTS.getOrDefault(c.getName(), 3));
                categories.save(c);
            }
        }
        if (services.count() == 0) {
            services.save(new ItService("Payment Application", 5));
            services.save(new ItService("VPN", 4));
            services.save(new ItService("Email", 3));
            services.save(new ItService("HR Portal", 2));
            services.save(new ItService("Printing", 1));
        }
        if (sla.count() == 0) {
            sla.save(new SlaPolicy(Priority.P1, 5, 30));
            sla.save(new SlaPolicy(Priority.P2, 15, 120));
            sla.save(new SlaPolicy(Priority.P3, 60, 480));
            sla.save(new SlaPolicy(Priority.P4, 240, 1440));
        }

        // Bootstrap administrator: only admins can create admins and technicians, so one must exist.
        if (users.findByRole(Role.ADMIN).isEmpty()) {
            ensure("Administrator", adminEmail, adminPassword, Role.ADMIN);
            log.info("Created bootstrap administrator account: {}", adminEmail);
        }

        if (seedDemoUsers) {
            ensure("Employee One", "employee@iitsm.com", "Employee@123", Role.EMPLOYEE);
            ensure("Tara Tech", "tech1@iitsm.com", "Tech@123", Role.TECHNICIAN, "Network", "Hardware");
            ensure("Sam Support", "tech2@iitsm.com", "Tech@123", Role.TECHNICIAN, "Software", "Email", "Database");
            ensure("Ravi Ops", "tech3@iitsm.com", "Tech@123", Role.TECHNICIAN, "Security & Access", "Network", "Software");
        }
    }

    private void ensure(String name, String email, String password, Role role, String... skills) {
        String e = email.trim().toLowerCase();
        if (users.existsByEmail(e)) return;
        User u = new User(name, e, encoder.encode(password), role);
        u.getSkills().addAll(List.of(skills));
        users.save(u);
    }
}
