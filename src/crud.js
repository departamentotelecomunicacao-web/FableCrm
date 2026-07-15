// Fábrica de rotas CRUD: gera list/get/create/update/delete + histórico +
// comentários para qualquer tabela de negócio, sempre com escopo por tenant,
// checagem de permissão do módulo e registro de auditoria.
const express = require('express');
const { query } = require('./db');
const { can } = require('./middleware/auth');
const { logAudit } = require('./audit');

function clean(body, fields) {
  const out = {};
  for (const f of fields) {
    if (f in body) out[f] = body[f] === '' || body[f] === undefined ? null : body[f];
  }
  return out;
}

function makeCrud(cfg) {
  const {
    table, entity, module: mod,
    fields, required = [],
    searchFields = [], filterFields = [],
    dateField = 'created_at',
    joins = '', selectExtra = '',
    orderBy = 't.id DESC',
    withComments = false,
    hooks = {},
  } = cfg;

  const router = express.Router();

  router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID inválido' });
    next();
  });

  router.get('/', can(mod, 'r'), async (req, res) => {
    const params = [req.user.tenantId];
    const where = ['t.tenant_id = $1'];

    if (req.query.q && searchFields.length) {
      params.push(`%${req.query.q}%`);
      where.push(`(${searchFields.map((f) => `t.${f}::text ILIKE $${params.length}`).join(' OR ')})`);
    }
    for (const f of filterFields) {
      if (req.query[f] !== undefined && req.query[f] !== '') {
        params.push(req.query[f]);
        where.push(`t.${f}::text = $${params.length}`);
      }
    }
    if (req.query.from) { params.push(req.query.from); where.push(`t.${dateField} >= $${params.length}`); }
    if (req.query.to) { params.push(req.query.to); where.push(`t.${dateField} <= $${params.length}::date + interval '1 day'`); }

    const limit = Math.min(parseInt(req.query.limit || '25', 10), 500);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const whereSql = where.join(' AND ');

    const totalQ = await query(`SELECT count(*)::int AS n FROM ${table} t WHERE ${whereSql}`, params);
    const rows = await query(
      `SELECT t.* ${selectExtra} FROM ${table} t ${joins} WHERE ${whereSql}
       ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    res.json({ rows: rows.rows, total: totalQ.rows[0].n, page, pages: Math.max(1, Math.ceil(totalQ.rows[0].n / limit)) });
  });

  router.get('/:id', can(mod, 'r'), async (req, res) => {
    const { rows } = await query(
      `SELECT t.* ${selectExtra} FROM ${table} t ${joins} WHERE t.tenant_id = $1 AND t.id = $2`,
      [req.user.tenantId, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(rows[0]);
  });

  router.post('/', can(mod, 'rw'), async (req, res) => {
    const data = clean(req.body, fields);
    for (const f of required) {
      if (data[f] === null || data[f] === undefined) {
        return res.status(400).json({ error: `Campo obrigatório: ${f}` });
      }
    }
    if (hooks.beforeSave) await hooks.beforeSave(data, req);
    const cols = Object.keys(data);
    const values = cols.map((c) => data[c]);
    const { rows } = await query(
      `INSERT INTO ${table} (tenant_id${cols.map((c) => `, ${c}`).join('')})
       VALUES ($1${cols.map((_, i) => `, $${i + 2}`).join('')}) RETURNING *`,
      [req.user.tenantId, ...values]);
    await logAudit({ req, entity, entityId: rows[0].id, action: 'create', after: rows[0] });
    if (hooks.afterSave) await hooks.afterSave(rows[0], req);
    res.status(201).json(rows[0]);
  });

  router.put('/:id', can(mod, 'rw'), async (req, res) => {
    const { rows: beforeRows } = await query(
      `SELECT * FROM ${table} WHERE tenant_id = $1 AND id = $2`, [req.user.tenantId, req.params.id]);
    if (!beforeRows.length) return res.status(404).json({ error: 'Registro não encontrado' });

    const data = clean(req.body, fields);
    if (hooks.beforeSave) await hooks.beforeSave(data, req, beforeRows[0]);
    const cols = Object.keys(data);
    if (!cols.length) return res.json(beforeRows[0]);
    const hasUpdatedAt = 'updated_at' in beforeRows[0];
    const { rows } = await query(
      `UPDATE ${table} SET ${cols.map((c, i) => `${c} = $${i + 3}`).join(', ')}${hasUpdatedAt ? ', updated_at = now()' : ''}
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [req.user.tenantId, req.params.id, ...cols.map((c) => data[c])]);
    await logAudit({ req, entity, entityId: rows[0].id, action: 'update', before: beforeRows[0], after: rows[0] });
    if (hooks.afterSave) await hooks.afterSave(rows[0], req);
    res.json(rows[0]);
  });

  router.delete('/:id', can(mod, 'rw'), async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM ${table} WHERE tenant_id = $1 AND id = $2`, [req.user.tenantId, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado' });
    try {
      await query(`DELETE FROM ${table} WHERE tenant_id = $1 AND id = $2`, [req.user.tenantId, req.params.id]);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(409).json({ error: 'Registro possui vínculos e não pode ser excluído.' });
      }
      throw err;
    }
    await logAudit({ req, entity, entityId: rows[0].id, action: 'delete', before: rows[0] });
    res.json({ ok: true });
  });

  // Histórico completo do registro (quem alterou, quando, o quê).
  router.get('/:id/history', can(mod, 'r'), async (req, res) => {
    const { rows } = await query(
      `SELECT id, user_name, action, changes, created_at FROM audit_log
       WHERE tenant_id = $1 AND entity = $2 AND entity_id = $3 ORDER BY created_at DESC LIMIT 200`,
      [req.user.tenantId, entity, req.params.id]);
    res.json(rows);
  });

  if (withComments) {
    router.get('/:id/comments', can(mod, 'r'), async (req, res) => {
      const { rows } = await query(
        `SELECT c.*, u.name AS user_name FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.tenant_id = $1 AND c.entity = $2 AND c.entity_id = $3 ORDER BY c.created_at DESC`,
        [req.user.tenantId, entity, req.params.id]);
      res.json(rows);
    });
    router.post('/:id/comments', can(mod, 'rw'), async (req, res) => {
      if (!req.body.body) return res.status(400).json({ error: 'Comentário vazio' });
      const { rows } = await query(
        `INSERT INTO comments (tenant_id, entity, entity_id, user_id, body)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.user.tenantId, entity, req.params.id, req.user.id, req.body.body]);
      res.status(201).json({ ...rows[0], user_name: req.user.name });
    });
  }

  return router;
}

module.exports = { makeCrud, clean };
