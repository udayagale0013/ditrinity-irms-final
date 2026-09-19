import type { PoolClient } from 'pg';
export async function audit(client: PoolClient, userId: string | null, action: string, entityType: string, entityId: string | null, oldValue: unknown, newValue: unknown) {
  await client.query(`INSERT INTO audit_events(user_id,action,entity_type,entity_id,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6)`, [userId,action,entityType,entityId,oldValue ? JSON.stringify(oldValue) : null,newValue ? JSON.stringify(newValue) : null]);
}
