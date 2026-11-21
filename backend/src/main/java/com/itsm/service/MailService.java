package com.itsm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.util.Properties;

/**
 * Sends email over SMTP when MAIL_HOST is set; otherwise only writes the email to the server log (simulated email).
 * Sending is asynchronous so a slow or failing mail server never blocks or rolls back incident handling.
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSenderImpl sender;
    private final String from;

    public MailService(@Value("${app.mail.host}") String host, @Value("${app.mail.port}") int port,
                       @Value("${app.mail.username}") String username, @Value("${app.mail.password}") String password,
                       @Value("${app.mail.from}") String from, @Value("${app.mail.starttls}") boolean starttls) {
        this.from = from;
        if (host == null || host.isBlank()) {
            this.sender = null;
            log.info("MAIL_HOST is not set: emails are written to the log only (simulated email).");
            return;
        }
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(host.trim());
        s.setPort(port);
        if (!username.isBlank()) {
            s.setUsername(username);
            s.setPassword(password);
        }
        Properties p = s.getJavaMailProperties();
        p.put("mail.smtp.auth", String.valueOf(!username.isBlank()));
        p.put("mail.smtp.starttls.enable", String.valueOf(starttls));
        p.put("mail.smtp.connectiontimeout", "10000");
        p.put("mail.smtp.timeout", "10000");
        p.put("mail.smtp.writetimeout", "10000");
        this.sender = s;
        log.info("Email delivery enabled via SMTP {}:{}", host, port);
    }

    public boolean isEnabled() { return sender != null; }

    @Async
    public void send(String to, String subject, String body) {
        if (sender == null) {
            log.info("[SIMULATED EMAIL] to={} subject=[{}] body={}", to, subject, body);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            sender.send(m);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            log.warn("Email to {} failed ({}): {}", to, subject, e.getMessage());
        }
    }
}
