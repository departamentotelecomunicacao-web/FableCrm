// Consulta do registro de auditoria (quem alterou, quando e o quê).
const express = require('express');
const { query } = require('../db');
const { can } = require('../middleware/auth');

const router = express.Router();

router.get('/', can('audit', 'r'), async (req, res) => {
  const params = [req.user.tenantId];
  const where = ['tenant_id = $1'];
  for (const f of ['entity', 'action', 'user_id']) {
    if (req.query[f]) { params.push(req.query[f]); where.push(`${f}::text = $${params.length}`); }
  }
  if (req.query.from) { params.push(req.query.from); where.push(`created_at >= $${params.length}`); }
  if (req.query.to) { params.push(req.query.to); where.push(`created_at <= $${params.length}::date + interval '1 day'`); }

  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const whereSql = where.join(' AND ');
  const total = (await query(`SELECT count(*)::int AS n FROM audit_log WHERE ${whereSql}`, params)).rows[0].n;
  const { rows } = await query(
    `SELECT * FROM audit_log WHERE ${whereSql} ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

module.exports = router;
