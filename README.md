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

Frontend: `VITE_API_URL` = backend base URL.

## Demo accounts (when SEED_DEMO=true)
admin@iitsm.com / Admin@123, employee@iitsm.com / Employee@123, tech1..3@iitsm.com / Tech@123

## Design decisions
- Priority score = impact x urgency x service criticality (1-125). P1 >= 75, P2 >= 40, P3 >= 15, else P4.
- SLA clock runs 24x7 from creation. Defaults (minutes, response/resolution): P1 5/30, P2 15/120, P3 60/480, P4 240/1440. Editable by admin.
- Assignment strategies (admin selectable): SKILL_BASED and LOAD_BASED. If no technician fits, the incident stays PRIORITIZED for manual assignment.
- Patterns: Strategy (priority, assignment), State (`IncidentStatus` transitions), Observer (`IncidentEvent` -> audit + notification listeners).
- Notifications: in-app (database) and simulated email (server log).
- Lifecycle: NEW > CLASSIFIED > PRIORITIZED > ASSIGNED > ACKNOWLEDGED > IN_PROGRESS > RESOLVED > VERIFIED > CLOSED (RESOLVED can be reopened to IN_PROGRESS).
- The assignment strategy choice is held in memory and resets to SKILL_BASED when the backend restarts.

## API summary
Auth: POST /api/auth/register, /api/auth/login. Incidents: POST/GET /api/incidents (filters: status, priority, categoryId, serviceId, technicianId, reporterId, q, from), GET/PUT/DELETE /api/incidents/{id}, POST /{id}/assign|acknowledge|start|notes|resolve|verify|reopen|close, GET /{id}/history.
Admin: /api/users, /api/technicians, /api/categories, /api/services, /api/sla/policies, /api/sla/violations, /api/config/assignment-strategy. Notifications: GET /api/notifications, POST /api/notifications/{id}/read.
