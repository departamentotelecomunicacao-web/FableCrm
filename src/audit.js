const { query } = require('./db');

// Campos que nunca devem aparecer no log de auditoria.
const HIDDEN = new Set(['password_hash']);

function diff(before, after) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (HIDDEN.has(k) || k === 'updated_at' || k === 'created_at') continue;
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes[k] = { de: b === undefined ? null : b, para: a === undefined ? null : a };
    }
  }
  return changes;
}

async function logAudit({ req, entity, entityId, action, before, after }) {
  const changes = action === 'update' ? diff(before, after)
    : action === 'create' ? diff({}, sanitize(after))
      : action === 'delete' ? diff(sanitize(before), {})
        : null;
  if (action === 'update' && changes && !Object.keys(changes).length) return;
  await query(
    `INSERT INTO audit_log (tenant_id, user_id, user_name, entity, entity_id, action, changes, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.user.tenantId, req.user.id, req.user.name, entity, entityId || null, action,
      changes ? JSON.stringify(changes) : null, req.ip]
  );
}

function sanitize(obj) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const k of HIDDEN) delete out[k];
  return out;
}

module.exports = { logAudit, diff };
