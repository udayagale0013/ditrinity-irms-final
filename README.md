# diTrinity IRMS — Final Application Baseline

This repository is a real application baseline for the diTrinity Internal Resource Management System. It is intentionally **not seeded with demo data**. All dashboard metrics, tables, matching results, SOW records, timesheets and audit activity come from PostgreSQL.

## What is implemented

- Login page with local development credentials and Microsoft Entra ID OAuth flow.
- Role-aware session and server-side authorization helpers.
- Professional HRMS-style dashboard matching the supplied visual direction, but using live DB queries instead of hard-coded numbers.
- Live CRUD over the deployed 41-table Railway PostgreSQL baseline.
- Resource master, skill taxonomy, availability, leave and client calendars.
- Accounts, projects, requirements and requirement skills.
- Deterministic resource eligibility + optional AI semantic matching. AI cannot allocate resources.
- Allocation records and protected activation endpoint with >100% visibility.
- Timesheet records, entries, exceptions and fail-closed client-calendar validation.
- SOW, versions, documents, mandatory RM/CM/BD/OPS/FINANCE approval tasks and approval/rework handling.
- External resources/contracts and PO-readiness table (insights only; no automatic PO creation).
- Pipeline and forecast records.
- Release/checklist/assets lifecycle with mandatory-checklist gate.
- Notifications and append-only audit trail.
- Power BI secure-embed backend using a service principal when configured.
- Zoho test-sync adapter that accepts real API-shaped JSON when Zoho access is unavailable; it writes through the same normalization path and does not generate fake records.
- Additive production DB extension migration for client calendar days, integration jobs, email signals, AI recommendation evidence, approval cycles, PO readiness and configuration.

## Architecture

`Next.js + React + TypeScript → PostgreSQL (Railway) → Power BI`

Optional integration boundaries:
- Microsoft Entra ID
- Zoho People REST/OAuth
- Microsoft Graph / SharePoint
- Azure OpenAI-compatible AI gateway
- Power Automate for notification/task delivery

The application keeps protected business state transitions on server-side APIs. Do not grant AI direct database credentials.

## Important: existing Railway database

You already have the 41-table baseline deployed. **Do not run the original 41-table schema again on a database that already contains it.**

1. Copy `.env.example` to `.env.local`.
2. Put the Railway `DATABASE_URL` in `.env.local`.
3. Run `npm install`.
4. Run `npm run verify:db`.
5. Run `db_extensions.sql` once against Railway PostgreSQL. This is additive (`ALTER TABLE ... IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS`).
6. Bootstrap the first admin:
   `npm run bootstrap:admin -- --email admin@ditrinity.com --name "IRMS Admin"`
7. Configure `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD` for local development login.
8. Run `npm run dev`.

## Production

For confidential production data, obtain company security approval before using Railway/Vercel. If private networking, corporate governance, managed identities and company-controlled networking are mandatory, deploy the backend/database in Azure instead.

Never commit `.env.local`, database passwords, OAuth secrets, AI keys or Power BI client secrets.

## No-demo-data policy

There is no seed script. The repository contains no fake employee, project, SOW, timesheet or dashboard records. A fresh database will therefore show zero/empty operational metrics until real records are entered or synchronized.

## Zoho when access is unavailable

Use **Integrations → Zoho test-sync adapter** and paste a real response payload. Example shape:

```json
{
  "employees": [
    {"zoho_employee_id":"123","name":"Real Employee","email":"employee@company.com","designation":"Engineer","location":"Pune"}
  ],
  "leaves": [],
  "timesheets": []
}
```

Timesheet rows need a real `project_id` from your IRMS database. The adapter does not invent a project.

## Power BI

Configure the six `POWERBI_*` values. The backend obtains an Azure AD token, reads the configured report and requests an embed token. The UI renders the configured report only when that real configuration succeeds.

## AI

Set `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` and `AI_API_VERSION` only after the approved Azure OpenAI/model endpoint is available. Without those variables, matching falls back to deterministic rules. This is an explicit fallback, not a fake AI score.
