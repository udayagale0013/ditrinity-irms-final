import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req:Request){
 try{
  const s=await requireSession();
  if(new URL(req.url).searchParams.get('format')==='csv'){
    const r=await query<any>(`SELECT 'resources' metric,COUNT(*) value FROM resources WHERE status='ACTIVE' UNION ALL SELECT 'open_requirements',COUNT(*) FROM requirements WHERE status NOT IN ('CLOSED','FULFILLED','CANCELLED') UNION ALL SELECT 'active_allocations',COUNT(*) FROM allocations WHERE status='ACTIVE' UNION ALL SELECT 'open_sows',COUNT(*) FROM sows WHERE status NOT IN ('COMPLETED','CLOSED')`);
    return new Response('metric,value\n'+r.rows.map(x=>`${x.metric},${x.value}`).join('\n'),{headers:{'content-type':'text/csv','content-disposition':'attachment; filename=irms-dashboard.csv'}});
  }
  const [resources,activeReq,allocations,openSows,timesheets,external,pipeline,upcoming,dept,skills] = await Promise.all([
   query<{count:string}>(`SELECT COUNT(*)::text count FROM resources WHERE status='ACTIVE'`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM requirements WHERE status NOT IN ('CLOSED','FULFILLED','CANCELLED')`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM allocations WHERE status='ACTIVE'`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM sows WHERE status NOT IN ('COMPLETED','CLOSED')`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM timesheets WHERE status NOT IN ('APPROVED','REJECTED')`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM external_resources WHERE status='ACTIVE'`),
   query<{count:string}>(`SELECT COUNT(*)::text count FROM pipeline_leads WHERE status='OPEN'`),
   query<{name:string,count:string}>(`SELECT to_char(start_date,'Mon') name, COUNT(*)::text count FROM requirements WHERE start_date >= CURRENT_DATE AND start_date < CURRENT_DATE + INTERVAL '6 months' GROUP BY to_char(start_date,'Mon'),date_trunc('month',start_date) ORDER BY date_trunc('month',start_date)`),
   query<{entity:string,count:string}>(`SELECT COALESCE(entity,'Unassigned') entity, COUNT(*)::text count FROM resources GROUP BY entity ORDER BY count(*) DESC LIMIT 8`),
   query<{name:string,count:string}>(`SELECT s.name,COUNT(rs.resource_id)::text count FROM skills s LEFT JOIN resource_skills rs ON rs.skill_id=s.id GROUP BY s.id,s.name ORDER BY COUNT(rs.resource_id) DESC LIMIT 8`),
  ]);
  const util=await query<{allocated:string,available:string}>(`SELECT COALESCE(SUM(allocation_percent)/NULLIF(COUNT(DISTINCT resource_id),0),0)::numeric allocated, GREATEST(0,100-COALESCE(SUM(allocation_percent)/NULLIF(COUNT(DISTINCT resource_id),0),0))::numeric available FROM allocations WHERE status='ACTIVE'`);
  const recent=await query<{action:string,entity_type:string,created_at:string}>(`SELECT action,entity_type,created_at::text FROM audit_events ORDER BY created_at DESC LIMIT 8`);
  return Response.json({ok:true,session:s,metrics:{resources:Number(resources.rows[0].count),openRequirements:Number(activeReq.rows[0].count),activeAllocations:Number(allocations.rows[0].count),openSows:Number(openSows.rows[0].count),pendingTimesheets:Number(timesheets.rows[0].count),externalResources:Number(external.rows[0].count),pipelineLeads:Number(pipeline.rows[0].count),utilization:Number(util.rows[0]?.allocated||0),capacityAvailable:Number(util.rows[0]?.available||0)},charts:{requirementsByMonth:upcoming.rows.map(x=>({label:x.name,value:Number(x.count)})),resourceByEntity:dept.rows.map(x=>({label:x.entity,value:Number(x.count)})),skills:skills.rows.map(x=>({label:x.name,value:Number(x.count)}))},recent:recent.rows});
 }catch(e){return Response.json({ok:false,error:{code:'DASHBOARD_ERROR',message:e instanceof Error?e.message:'Unknown error'}},{status:500})}
}
