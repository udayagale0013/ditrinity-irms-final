
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

console.log('Database URL loaded from .env.local');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: false }
});

const expected = [
  'roles',
  'permissions',
  'users',
  'user_roles',
  'resources',
  'skills',
  'resource_skills',
  'resource_availability',
  'leave_records',
  'holiday_calendars',
  'accounts',
  'projects',
  'project_members',
  'requirements',
  'requirement_skills',
  'match_runs',
  'match_results',
  'allocations',
  'allocation_history',
  'capacity_snapshots',
  'timesheets',
  'timesheet_entries',
  'timesheet_exceptions',
  'sows',
  'sow_versions',
  'sow_documents',
  'sow_approvals',
  'rate_cards',
  'rate_card_versions',
  'external_organizations',
  'external_resources',
  'external_resource_contracts',
  'pipeline_leads',
  'forecasts',
  'releases',
  'release_checklists',
  'checklist_items',
  'assets',
  'asset_assignments',
  'notifications',
  'audit_events'
];

try {
  console.log('Connecting to Railway PostgreSQL...');

  const r = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
  `, [expected]);

  const found = new Set(r.rows.map(x => x.table_name));

  console.log(`Found ${found.size}/${expected.length} baseline tables`);

  for (const table of expected) {
    if (found.has(table)) {
      console.log('OK', table);
    } else {
      console.log('MISSING', table);
    }
  }

  if (found.size === expected.length) {
    console.log('\nDATABASE VERIFICATION SUCCESSFUL');
    process.exit(0);
  } else {
    console.log(
      `\nDATABASE VERIFICATION INCOMPLETE: ${expected.length - found.size} table(s) missing`
    );
    process.exit(2);
  }
} catch (error) {
  console.error('\nDATABASE CONNECTION FAILED');
  console.error(error.message);
  process.exit(1);
} finally {
  await pool.end();
}

