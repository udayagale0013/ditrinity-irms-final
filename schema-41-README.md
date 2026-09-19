# IRMS PostgreSQL Database — Railway

Starter database package for the diTrinity Internal Resource Management System.

Target: PostgreSQL 15+ and Railway PostgreSQL.

Contains 41 tables covering resources, skills, accounts, projects, requirements, matching, allocation, timesheets, SOW, approvals, external resources, forecasting, release, assets, checklists, notifications and audit.

## Files
- schema.sql — PostgreSQL DDL for all 41 tables
- .env.example — DATABASE_URL example

## Railway
1. Create a PostgreSQL service in Railway.
2. Copy Railway DATABASE_URL into your backend environment.
3. Run schema.sql using Railway's SQL client/console or psql.
4. Keep production credentials out of GitHub.
5. Use separate development/staging and production databases.

Security: get company IT/security approval before putting confidential IRMS production data on Railway.
