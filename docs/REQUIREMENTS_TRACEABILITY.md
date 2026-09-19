# Requirements → Implementation Traceability

Source material reviewed for this baseline:
- diTrinity SRS Implementation-Ready Technical Baseline v0.5.1 (24 Aug 2026)
- BRD AI Resource Management baseline supplied with the project
- Supplied dashboard reference image
- Existing Railway 41-table SQL baseline

## Core SRS rules represented in the application

| Requirement area | Application implementation |
|---|---|
| Resource master | `/resources`, `resources`, `skills`, `resource_skills`, availability, leave, calendars |
| Requirement intake | `/requirements`, `requirements`, `requirement_skills` |
| Client/internal matching | `/matching`, `/api/matching/run` |
| Human-in-the-loop AI | AI produces candidate scores/reasons only; allocation remains a user action |
| Allocation | `/allocations`, protected `/api/allocations/[id]/activate` |
| Concurrent / >100% | Activation calculates concurrent allocation and returns warning; no silent blocking |
| Timesheet validation | `/timesheets`, `/api/timesheets/[id]/validate`; client calendar and leave are checked; missing calendar/day config fails closed |
| SOW lifecycle | `/sow`, SOW + versions + documents + approvals |
| Mandatory SOW approvals | RM / CM / BD / OPS / FINANCE approval rows are created when a SOW is created |
| SOW rejection/rework | Approval API moves SOW to REWORK when a mandatory approval rejects |
| Approval state authority | Server API changes approval state; generic CRUD blocks protected state fields |
| External resources | `/external`, external organization/resource/contract tables |
| PO readiness | `po_readiness` extension table; no automatic PO creation |
| Pipeline / forecast | `/pipeline`, pipeline and forecast tables |
| Release lifecycle | `/releases`; mandatory checklist completion is required before final completion |
| Audit | `audit_events` receives create/update/delete and protected workflow events |
| Reporting | `/powerbi`, secure Power BI token generation when credentials exist |
| Integration observability | `integration_jobs` extension table + Zoho test sync |
| AI evidence | `ai_recommendations` extension table is available for model/prompt/version/output evidence |
| Role/security | session roles + API role checks + Entra integration boundary |

## Important source-to-build gap handling

The supplied 41-table SQL is a starter foundation and does not contain every logical object named in the SRS. Instead of silently pretending those fields/tables exist, `db_extensions.sql` adds the missing production-supporting structures and fields.

Notably:
- client calendar day/holiday detail is added through `client_calendar_days`;
- integration state is added through `integration_jobs`;
- mail intelligence evidence is added through `email_signals`;
- AI recommendation evidence is added through `ai_recommendations`;
- SOW approval-cycle state is added through `approval_cycles`;
- PO readiness is added through `po_readiness`;
- configuration is added through `configuration_entries`.

## Current DocuSign decision

The older source material contains DocuSign as an integration option. The current implementation intentionally does **not** make DocuSign a required dependency. SOW documents can be registered manually/through the email intelligence boundary. If the project later reintroduces DocuSign, add the signed webhook/idempotency implementation before enabling it in production.

## Power Platform position

The supplied SRS describes Power Apps/Dataverse as the target technical contract, while the current project build direction is a custom web application with PostgreSQL. This repository therefore implements the same business capabilities on a custom web/API architecture instead of pretending that Power Apps/Dataverse are present. Power Automate/Power BI remain integration/reporting options.
