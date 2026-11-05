import { stmt } from '../lib/db.js';
import type { Actor, Services } from './context.js';

export function auditStmt(
  svc: Services,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string | number | null,
  detail?: unknown,
): D1PreparedStatement {
  return stmt(
    svc.db,
    `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    actor.type,
    actor.id,
    action,
    entity,
    entityId === null ? null : String(entityId),
    detail === undefined ? null : JSON.stringify(detail),
    svc.now(),
  );
}
