package com.itsm.controller;

import com.itsm.dto.Dtos.*;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.exception.ApiException;
import com.itsm.repository.UserRepository;
import com.itsm.security.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    @GetMapping("/api/health")
    public Map<String, String> health() { return Map.of("status", "UP"); }

    /** Self-registration always creates an EMPLOYEE; admins create other roles via /api/users. */
    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto register(@Valid @RequestBody RegisterRequest r) {
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        return UserDto.from(users.save(new User(r.name().trim(), email, encoder.encode(r.password()), Role.EMPLOYEE)));
    }

    @PostMapping("/api/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        User u = users.findByEmail(r.email().trim().toLowerCase())
                .filter(x -> encoder.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return new AuthResponse(jwt.generate(u), UserDto.from(u));
    }
}
