import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-change-me');
const COOKIE = 'irms_session';

type Session = { userId: string; email: string; name: string; roles: string[] };

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 60 * 60 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: String(payload.userId), email: String(payload.email), name: String(payload.name), roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [] };
  } catch { return null; }
}

export async function getSessionWithFreshRoles() {
  const s = await getSession();
  if (!s) return null;
  const r = await query<{ name: string }>(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1 ORDER BY r.name`, [s.userId]);
  return { ...s, roles: r.rows.map(x => x.name) };
}

export function hasRole(session: Session | null, allowed: string[]) {
  return !!session && (session.roles.includes('ADMIN') || allowed.some(r => session.roles.includes(r)));
}

export async function requireSession() {
  const s = await getSessionWithFreshRoles();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}
