import { db } from '../db';

export interface AuditEntry {
  userId?: number;
  entity: string;
  entityId: number;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}

export function audit(e: AuditEntry) {
  return db.run(
    'INSERT INTO audit_log (user_id, entity, entity_id, action, from_status, to_status, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [e.userId ?? null, e.entity, e.entityId, e.action, e.fromStatus ?? null, e.toStatus ?? null, e.note || null],
  );
}

/** History of one record, oldest first, with the name of who did each step. */
export function history(entity: string, entityId: number) {
  return db.many(
    `SELECT a.id, a.action, a.from_status, a.to_status, a.note, a.created_at, COALESCE(u.name, CASE WHEN a.user_id IS NULL THEN 'System' ELSE 'Deleted user' END) AS by
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.entity = $1 AND a.entity_id = $2
      ORDER BY a.created_at, a.id`,
    [entity, entityId],
  );
}
