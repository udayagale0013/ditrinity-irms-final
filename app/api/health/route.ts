import { query } from '@/lib/db';
export async function GET(){try{await query('SELECT 1');return Response.json({ok:true,database:'reachable',timestamp:new Date().toISOString()})}catch(e){return Response.json({ok:false,database:'unreachable',message:e instanceof Error?e.message:'unknown'},{status:503})}}
