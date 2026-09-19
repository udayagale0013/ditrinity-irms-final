-- Production requirement extensions for the already deployed 41-table IRMS baseline.
-- This migration is additive and does not delete/rename any existing 41-table objects.
BEGIN;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true, ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'INTERNAL', ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS assigned_am_user_id UUID REFERENCES users(id), ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS version_no INT DEFAULT 1, ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50), ADD COLUMN IF NOT EXISTS raised_by_role VARCHAR(50), ADD COLUMN IF NOT EXISTS demand_source VARCHAR(50), ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
ALTER TABLE holiday_calendars ADD COLUMN IF NOT EXISTS country VARCHAR(100), ADD COLUMN IF NOT EXISTS timezone VARCHAR(80);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS billing_ready BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS client_approved BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS client_approval_evidence TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS msa_id UUID, ADD COLUMN IF NOT EXISTS adoption_agreement_id UUID, ADD COLUMN IF NOT EXISTS billing_type VARCHAR(80), ADD COLUMN IF NOT EXISTS finance_attested BOOLEAN DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS country VARCHAR(100), ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50), ADD COLUMN IF NOT EXISTS billable_status VARCHAR(50) DEFAULT 'UNKNOWN';

CREATE TABLE IF NOT EXISTS client_calendar_days (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), calendar_id UUID NOT NULL REFERENCES holiday_calendars(id) ON DELETE CASCADE,
 calendar_date DATE NOT NULL, is_working_day BOOLEAN DEFAULT false, holiday_name VARCHAR(200), UNIQUE(calendar_id,calendar_date)
);
CREATE TABLE IF NOT EXISTS integration_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source VARCHAR(80) NOT NULL, operation VARCHAR(120) NOT NULL,
 status VARCHAR(40) NOT NULL DEFAULT 'PENDING', attempts INT NOT NULL DEFAULT 0, correlation_id VARCHAR(120),
 external_id VARCHAR(200), error_message TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_signals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider VARCHAR(50) NOT NULL, message_id VARCHAR(255) NOT NULL UNIQUE,
 sender VARCHAR(255), subject TEXT, received_at TIMESTAMPTZ, classification VARCHAR(100), confidence NUMERIC(6,3),
 extracted_data JSONB, content_hash VARCHAR(255), review_status VARCHAR(40) DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_recommendations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recommendation_type VARCHAR(80) NOT NULL, source_entity VARCHAR(80),
 source_id UUID, model_name VARCHAR(150), model_version VARCHAR(150), prompt_version VARCHAR(100), input_hash VARCHAR(255),
 output JSONB NOT NULL, confidence NUMERIC(6,3), human_decision VARCHAR(50), created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_cycles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sow_id UUID NOT NULL REFERENCES sows(id) ON DELETE CASCADE,
 version_id UUID REFERENCES sow_versions(id), cycle_no INT NOT NULL, status VARCHAR(40) DEFAULT 'PENDING',
 started_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ, UNIQUE(sow_id,cycle_no)
);
CREATE TABLE IF NOT EXISTS po_readiness (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), external_resource_id UUID REFERENCES external_resources(id),
 project_id UUID REFERENCES projects(id), contract_id UUID REFERENCES external_resource_contracts(id), readiness_status VARCHAR(50) DEFAULT 'PENDING',
 missing_items JSONB, evidence JSONB, evaluated_at TIMESTAMPTZ DEFAULT now(), evaluated_by UUID REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS configuration_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_key VARCHAR(180) UNIQUE NOT NULL, config_value JSONB NOT NULL,
 description TEXT, updated_by UUID REFERENCES users(id), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_status ON integration_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS idx_email_signals_review ON email_signals(review_status,received_at);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_source ON ai_recommendations(source_entity,source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_days_date ON client_calendar_days(calendar_id,calendar_date);
COMMIT;
