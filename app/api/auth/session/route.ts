import {getSessionWithFreshRoles} from '@/lib/auth'; export async function GET(){const s=await getSessionWithFreshRoles();return Response.json({ok:!!s,session:s})}
