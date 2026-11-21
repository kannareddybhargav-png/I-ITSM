package com.itsm.controller;

import com.itsm.dto.Dtos.*;
import com.itsm.entity.Notification;
import com.itsm.entity.Role;
import com.itsm.entity.User;
import com.itsm.exception.ApiException;
import com.itsm.repository.NotificationRepository;
import com.itsm.repository.UserRepository;
import com.itsm.security.JwtService;
import com.itsm.service.MailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final NotificationRepository notifications;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final MailService mail;
    @Value("${app.auth.email-verification}") private boolean verificationRequired;
    @Value("${app.auth.verification-hours}") private int verificationHours;
    @Value("${app.frontend-url}") private String frontendUrl;

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "build", "email-verify-v1", "emailVerification", verificationRequired, "smtpConfigured", mail.isEnabled());
    }

    /**
     * Self-registration always creates an EMPLOYEE. Two checks follow: the person must click the link emailed to the
     * address (proves the address is theirs), then an administrator must verify the account before incidents can be
     * reported. Accounts created by an administrator are trusted and skip both.
     */
    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest r) {
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        User u = new User(r.name().trim(), email, encoder.encode(r.password()), Role.EMPLOYEE);
        u.setVerified(false);
        if (!verificationRequired) {
            u.setEmailVerified(true);
            u = users.save(u);
            notifyAdminsPending(u);
            return new RegisterResponse(UserDto.from(u), false, "Account created. An administrator will verify it before you can report incidents.");
        }
        u.setEmailVerified(false);
        u = users.save(u);
        sendVerification(u);
        String note = mail.isEnabled() ? "" : " (Email sending is not configured on this server, so the link was written to the server log.)";
        return new RegisterResponse(UserDto.from(u), true,
                "Account created. We sent a confirmation link to " + email + ". Open it to activate your account; "
                        + "an administrator then verifies you before you can report incidents." + note);
    }

    @PostMapping("/api/auth/verify")
    public Map<String, String> verify(@Valid @RequestBody VerifyRequest r) {
        User u = users.findByVerificationToken(r.token().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "This confirmation link is invalid or was already used."));
        if (u.getVerificationExpiresAt() == null || Instant.now().isAfter(u.getVerificationExpiresAt()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "This confirmation link has expired. Request a new one from the sign-in page.");
        u.setEmailVerified(true);
        u.setVerificationToken(null);
        u.setVerificationExpiresAt(null);
        users.save(u);
        notifyAdminsPending(u);
        return Map.of("message", "Email confirmed. You can now sign in. An administrator still has to verify your account before you can report incidents.");
    }

    /** Always answers the same way so it cannot be used to find out which addresses are registered. */
    @PostMapping("/api/auth/resend-verification")
    public Map<String, String> resend(@Valid @RequestBody ResendRequest r) {
        users.findByEmail(r.email().trim().toLowerCase())
                .filter(u -> !u.isEmailConfirmed())
                .ifPresent(this::sendVerification);
        return Map.of("message", "If that account is waiting for confirmation, a new link has been sent.");
    }

    @PostMapping("/api/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        User u = users.findByEmail(r.email().trim().toLowerCase())
                .filter(x -> encoder.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (verificationRequired && !u.isEmailConfirmed())
            throw new ApiException(HttpStatus.FORBIDDEN, "Please confirm your email address first. Check your inbox for the link.");
        return new AuthResponse(jwt.generate(u), UserDto.from(u));
    }

    /** Fresh copy of the signed-in user, so the app notices when an administrator verifies the account. */
    @GetMapping("/api/me")
    public UserDto me(@AuthenticationPrincipal User me) { return UserDto.from(me); }

    private void notifyAdminsPending(User u) {
        for (User admin : users.findByRole(Role.ADMIN)) {
            Notification n = new Notification();
            n.setUser(admin);
            n.setType("EMPLOYEE_PENDING");
            n.setMessage("New employee " + u.getName() + " (" + u.getEmail() + ") is waiting for verification.");
            notifications.save(n);
        }
    }

    private void sendVerification(User u) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        u.setVerificationToken(token);
        u.setVerificationExpiresAt(Instant.now().plus(Duration.ofHours(verificationHours)));
        users.save(u);
        String link = frontendUrl.replaceAll("/+$", "") + "/?verify=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
        mail.send(u.getEmail(), "[I-ITSM] Confirm your email address",
                "Hello " + u.getName() + ",\n\nPlease confirm your email address to activate your I-ITSM account:\n\n" + link
                        + "\n\nThe link is valid for " + verificationHours + " hours. If you did not sign up, ignore this email.");
    }
}
