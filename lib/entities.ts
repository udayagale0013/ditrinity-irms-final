export const ENTITIES = [
  'roles','permissions','users','user_roles','resources','skills','resource_skills','resource_availability','leave_records','holiday_calendars',
  'accounts','projects','project_members','requirements','requirement_skills','match_runs','match_results','allocations','allocation_history','capacity_snapshots',
  'timesheets','timesheet_entries','timesheet_exceptions','sows','sow_versions','sow_documents','sow_approvals','rate_cards','rate_card_versions',
  'external_organizations','external_resources','external_resource_contracts','pipeline_leads','forecasts','releases','release_checklists','checklist_items',
  'assets','asset_assignments','notifications','audit_events'
] as const;
export const EXTENDED_ENTITIES = ['client_calendar_days','integration_jobs','email_signals','ai_recommendations','approval_cycles','po_readiness','configuration_entries'] as const;
export type Entity = typeof ENTITIES[number] | typeof EXTENDED_ENTITIES[number];
export const READ_ONLY = new Set(['allocation_history','audit_events','notifications','match_runs','match_results','capacity_snapshots','integration_jobs','email_signals','ai_recommendations','approval_cycles','po_readiness']);
export const LABELS: Record<string,string> = Object.fromEntries(ENTITIES.map(x => [x, x.split('_').map(s => s[0].toUpperCase()+s.slice(1)).join(' ')]));
export const COMPOSITE_ENTITIES = new Set(['user_roles','resource_skills','project_members','requirement_skills']);
export const ID_COLUMNS: Record<string,string> = {
  user_roles:'user_id', resource_skills:'resource_id', project_members:'project_id', requirement_skills:'requirement_id',
};
export const MODULES = [
  {key:'resources', label:'Resources', entities:['resources','skills','resource_skills','resource_availability','leave_records','holiday_calendars']},
  {key:'demand', label:'Demand & Matching', entities:['accounts','projects','requirements','requirement_skills','match_runs','match_results','allocations','allocation_history','capacity_snapshots']},
  {key:'operations', label:'Timesheets', entities:['timesheets','timesheet_entries','timesheet_exceptions']},
  {key:'sow', label:'SOW & Commercial', entities:['sows','sow_versions','sow_documents','sow_approvals','rate_cards','rate_card_versions']},
  {key:'external', label:'External & PO Readiness', entities:['external_organizations','external_resources','external_resource_contracts']},
  {key:'forecast', label:'Pipeline & Forecast', entities:['pipeline_leads','forecasts']},
  {key:'release', label:'Release & Assets', entities:['releases','release_checklists','checklist_items','assets','asset_assignments']},
  {key:'system', label:'System', entities:['roles','permissions','users','user_roles','notifications','audit_events']},
] as const;
