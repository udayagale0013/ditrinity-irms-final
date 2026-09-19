import { requireSession } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { audit } from '@/lib/audit';
import { aiJson } from '@/lib/ai';

export async function POST(req:Request){
 try{
  const s=await requireSession(); const {requirementId}=await req.json(); if(!requirementId) return Response.json({ok:false,error:{code:'REQUIREMENT_ID_REQUIRED'}},{status:400});
  const reqR=await query<any>(`SELECT r.*,p.name project_name,a.name account_name FROM requirements r JOIN projects p ON p.id=r.project_id JOIN accounts a ON a.id=p.account_id WHERE r.id=$1`,[requirementId]);
  if(!reqR.rowCount) return Response.json({ok:false,error:{code:'REQUIREMENT_NOT_FOUND'}},{status:404});
  const reqd=reqR.rows[0]; const skills=await query<any>(`SELECT rs.*,s.name skill_name FROM requirement_skills rs JOIN skills s ON s.id=rs.skill_id WHERE rs.requirement_id=$1`,[requirementId]);
  const candidates=await query<any>(`SELECT r.id,r.resource_code,r.name,r.email,r.experience_years,r.location,r.entity,r.status,
   COALESCE(SUM(CASE WHEN a.status='ACTIVE' AND (a.end_date IS NULL OR a.end_date>=CURRENT_DATE) AND a.start_date<=COALESCE($3::date,CURRENT_DATE) THEN a.allocation_percent ELSE 0 END),0)::numeric allocated_percent
   FROM resources r LEFT JOIN allocations a ON a.resource_id=r.id
   WHERE r.status='ACTIVE' AND ($1::numeric IS NULL OR r.experience_years >= $1) AND ($2='' OR LOWER(r.location)=LOWER($2))
   GROUP BY r.id ORDER BY allocated_percent ASC,r.experience_years DESC LIMIT 50`,[reqd.min_experience_years,reqd.location||'',reqd.start_date]);
  const ids=candidates.rows.map(x=>x.id); const rs=ids.length?await query<any>(`SELECT rs.resource_id,s.name,rs.proficiency,rs.years_experience FROM resource_skills rs JOIN skills s ON s.id=rs.skill_id WHERE rs.resource_id=ANY($1::uuid[])`,[ids]):{rows:[]};
  const skillMap=new Map<string,any[]>(); for(const x of rs.rows){if(!skillMap.has(x.resource_id))skillMap.set(x.resource_id,[]);skillMap.get(x.resource_id)!.push(x)}
  const ruleResults=candidates.rows.map(c=>{const have=skillMap.get(c.id)||[];let matched=0;let mandatory=0;for(const need of skills.rows){if(need.is_mandatory)mandatory++;if(have.some((h:any)=>h.name.toLowerCase()===need.skill_name.toLowerCase()))matched++}const skillScore=mandatory?matched/mandatory*70:(have.length?50:0);const avail=Math.max(0,100-Number(c.allocated_percent||0));const availabilityScore=Math.min(30,avail*.3);return {...c,skills:have,rule_score:Number((skillScore+availabilityScore).toFixed(3))}});
  const aiInput=ruleResults.slice(0,20).map((c:any)=>({id:c.id,name:c.name,experience:c.experience_years,location:c.location,allocatedPercent:c.allocated_percent,skills:c.skills}));
  let aiMap=new Map<string,{score:number,reason:string}>();
  try{const out=await aiJson<{matches:{resourceId:string,score:number,reason:string}[]}>(`You are a resource matching assistant. You only recommend candidates; never allocate or change system state. Return JSON with matches array. Score 0-100 based only on requirement fit. Do not invent facts.`,JSON.stringify({requirement:reqd,requiredSkills:skills.rows,candidates:aiInput})); if(out?.matches) aiMap=new Map(out.matches.map(x=>[x.resourceId,{score:Number(x.score),reason:String(x.reason)}]));}catch{ /* rule-only fallback is intentional */ }
  const ranked=ruleResults.map((c:any)=>{const ai=aiMap.get(c.id);const final=ai?Number((c.rule_score*.55+ai.score*.45).toFixed(3)):c.rule_score;return {...c,ai_score:ai?.score??null,final_score:final,recommendation_reason:ai?.reason||`Rule match: skill coverage and current availability.`,decision:'PENDING'}}).sort((a,b)=>b.final_score-a.final_score).map((x,i)=>({...x,rank:i+1}));
  const run=await withTransaction(async client=>{const aiTable=await client.query(`SELECT to_regclass('public.ai_recommendations') AS t`); const mr=await client.query(`INSERT INTO match_runs(requirement_id,run_type,model_name,status,created_by) VALUES($1,$2,$3,'COMPLETED',$4) RETURNING *`,[requirementId,aiMap.size?'HYBRID':'RULE_ONLY',process.env.AI_MODEL||null,s.userId]); if(aiMap.size && aiTable.rows[0].t) await client.query(`INSERT INTO ai_recommendations(recommendation_type,source_entity,source_id,model_name,prompt_version,input_hash,output,confidence,created_by) VALUES('RESOURCE_MATCHING','requirements',$1,$2,'v1',md5($3),$4,$5,$6)`,[requirementId,process.env.AI_MODEL||'configured-model',JSON.stringify({requirement:reqd,requiredSkills:skills.rows,candidates:aiInput}),JSON.stringify({matches:[...aiMap.entries()].map(([resourceId,v])=>({resourceId,...v}))}),Math.max(...[...aiMap.values()].map(v=>v.score),0),s.userId]); for(const x of ranked) await client.query(`INSERT INTO match_results(match_run_id,resource_id,rule_score,ai_score,final_score,recommendation_reason,rank,decision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[mr.rows[0].id,x.id,x.rule_score,x.ai_score,x.final_score,x.recommendation_reason,x.rank,x.decision]); await audit(client,s.userId,'MATCH_RUN','requirements',requirementId,null,{runId:mr.rows[0].id,candidateCount:ranked.length}); return mr.rows[0];});
  return Response.json({ok:true,run,results:ranked});
 }catch(e){return Response.json({ok:false,error:{code:'MATCHING_ERROR',message:e instanceof Error?e.message:'Unknown error'}},{status:500})}
}
