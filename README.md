# I-ITSM (Intelligent IT Service Management) - Level 1 MVP

React (Vite) frontend + Spring Boot 3 / Java 17 backend + PostgreSQL.

## Run locally
1. Create a Postgres database: `createdb iitsm` (or use a hosted one).
2. Backend: `cd backend && mvn spring-boot:run` (env vars below are optional locally).
3. Frontend: `cd frontend && cp .env.example .env && npm install && npm run dev` -> http://localhost:5173

Tables are created automatically on first start (`spring.jpa.hibernate.ddl-auto=update`) and reference data is seeded.

## Backend environment variables
| Variable | Purpose | Default |
|---|---|---|
| DB_URL | JDBC URL, e.g. `jdbc:postgresql://host:5432/dbname?sslmode=require` | local Postgres |
| DB_USER / DB_PASSWORD | database credentials | postgres / postgres |
| JWT_SECRET | at least 32 characters, keep private | dev value |
| CORS_ORIGINS | comma separated frontend URLs | http://localhost:5173 |
| SEED_DEMO | create demo users on an empty database | true |
| MAIL_HOST / MAIL_PORT | SMTP server; leave MAIL_HOST empty to only log emails | empty / 587 |
| MAIL_USERNAME / MAIL_PASSWORD | SMTP login (for Gmail use an app password) | empty |
| MAIL_FROM | sender shown on emails | I-ITSM Service Desk <no-reply@iitsm.local> |
| MAIL_STARTTLS | use STARTTLS | true |
| EMAIL_VERIFICATION | new self-registered employees must click an emailed link before signing in | true |
| VERIFICATION_HOURS | how long the confirmation link is valid | 24 |
| FRONTEND_URL | used to build the confirmation link | http://localhost:5173 |

Frontend: `VITE_API_URL` = backend base URL.

## Demo accounts (when SEED_DEMO=true)
admin@iitsm.com / Admin@123, employee@iitsm.com / Employee@123, tech1..3@iitsm.com / Tech@123

## Design decisions
- Priority score = service impact weight x category criticality weight x urgency (each 1-5, so 1-125). Only urgency is chosen by the employee; admins edit the service and category weights. P1 >= 75, P2 >= 40, P3 >= 15, else P4.
- Duplicate detection: an open incident from the last 48 hours is a possible duplicate when it affects the same service and shares a keyword, or is in the same category and shares two keywords. The new incident is linked, admins and the technician are notified, and the technician already handling the original is preferred.
- Escalation (checked every 30 s, P1 and P2 only): level 1 when the response deadline passes without acknowledgement (administrators alerted), level 2 after a second response window (escalated to IT management and reassigned to another available technician).
- SLA clock runs 24x7 from creation. Defaults (minutes, response/resolution): P1 5/30, P2 15/120, P3 60/480, P4 240/1440. Editable by admin.
- Assignment strategies (admin selectable): SKILL_BASED and LOAD_BASED. If no technician fits, the incident stays PRIORITIZED for manual assignment.
- Patterns: Strategy (priority, assignment), State (`IncidentStatus` transitions), Observer (`IncidentEvent` -> audit + notification listeners).
- Incident IDs: `INC-<priority>-<number>`, e.g. `INC-P1-0008`. A detected duplicate shares the number of the incident it duplicates and gets a suffix: `INC-P3-0003-D1`, `INC-P3-0003-D2`. The priority part follows the current priority. Search also accepts an ID. Existing incidents are given IDs on startup.
- Notifications: in-app (database) and email. Email is sent over SMTP when MAIL_HOST is set, otherwise it is only written to the server log (`[SIMULATED EMAIL]`). Sending is asynchronous; a failed email is logged and never blocks the incident.
- Email verification (EMAIL_VERIFICATION=true): self-registration sends a confirmation link (`FRONTEND_URL/?verify=<token>`); sign-in is refused until it is clicked, and a new link can be requested from the sign-in screen. Accounts created by an administrator, seeded accounts and accounts that existed before the feature are treated as verified.
- Lifecycle: NEW > CLASSIFIED > PRIORITIZED > ASSIGNED > ACKNOWLEDGED > IN_PROGRESS > RESOLVED > VERIFIED > CLOSED (RESOLVED can be reopened to IN_PROGRESS).
- The assignment strategy choice is held in memory and resets to SKILL_BASED when the backend restarts.

## API summary
Auth: POST /api/auth/register, /api/auth/login, /api/auth/verify, /api/auth/resend-verification; GET /api/auth/config. Incidents: POST/GET /api/incidents (filters: status, priority, categoryId, serviceId, technicianId, reporterId, q, from), GET/PUT/DELETE /api/incidents/{id}, POST /{id}/assign|acknowledge|start|notes|resolve|verify|reopen|close, GET /{id}/history.
Admin: /api/users, /api/technicians, /api/categories, /api/services, /api/sla/policies, /api/sla/violations, /api/config/assignment-strategy. Notifications: GET /api/notifications, POST /api/notifications/{id}/read.

## Ratings, feedback and the audit log
- When an employee confirms a resolution they must give a 1-5 star rating (a written comment is optional); the feedback is attached to the incident.
- Technician rating = (initial rating + all employee star ratings) / (ratings + 1), minus 0.25 for every SLA breach that happened while the technician was assigned, kept between 1 and 5. Initial rating and penalty are configurable with `RATING_INITIAL` (default 4.0) and `RATING_SLA_PENALTY` (default 0.25). Technicians see their rating on their dashboard; administrators see it in Administration > People.
- Technicians can ask the reporter for more information (also before acknowledging); the reporter answers on the incident page. Reporters can edit an incident until it is acknowledged.
- Administration > Audit log lists every audit entry across all incidents (filters, paging, CSV export) via `GET /api/audit` (administrators only, read-only).
