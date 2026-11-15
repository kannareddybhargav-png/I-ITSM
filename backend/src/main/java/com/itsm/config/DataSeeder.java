package com.itsm.config;

import com.itsm.entity.*;
import com.itsm.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.Set;

/** Seeds reference data (categories, services, SLA policies) and, optionally, demo users. */
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
    private final UserRepository users;
    private final CategoryRepository categories;
    private final ItServiceRepository services;
    private final SlaPolicyRepository sla;
    private final PasswordEncoder encoder;
    @Value("${app.seed-demo-users}") private boolean seedUsers;

    @Override
    public void run(String... args) {
        if (categories.count() == 0) {
            for (String c : new String[]{"Network", "Hardware", "Software", "Email", "Security & Access", "Database"})
                categories.save(new Category(c));
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
        if (seedUsers && users.count() == 0) {
            users.save(new User("Admin", "admin@iitsm.com", encoder.encode("Admin@123"), Role.ADMIN));
            users.save(new User("Employee One", "employee@iitsm.com", encoder.encode("Employee@123"), Role.EMPLOYEE));
            tech("Tara Tech", "tech1@iitsm.com", Set.of("Network", "Hardware"));
            tech("Sam Support", "tech2@iitsm.com", Set.of("Software", "Email", "Database"));
            tech("Ravi Ops", "tech3@iitsm.com", Set.of("Security & Access", "Network", "Software"));
        }
    }

    private void tech(String name, String email, Set<String> skills) {
        User u = new User(name, email, encoder.encode("Tech@123"), Role.TECHNICIAN);
        u.getSkills().addAll(skills);
        users.save(u);
    }
}
