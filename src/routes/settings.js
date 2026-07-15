// Configurações: cadastros de apoio (segmentos, origens, motivos de perda,
// equipes, status) e gestão de usuários.
const express = require('express');
const bcrypt = require('bcryptjs');
const { makeCrud } = require('../crud');
const { query } = require('../db');
const { can } = require('../middleware/auth');
const { logAudit } = require('../audit');
const { ROLE_PERMS } = require('../permissions');

const simple = (table, entity) => makeCrud({
  table, entity, module: 'settings',
  fields: ['name'], required: ['name'], searchFields: ['name'], orderBy: 't.name',
});

const segments = simple('segments', 'segments');
const sources = simple('lead_sources', 'lead_sources');
const lossReasons = simple('loss_reasons', 'loss_reasons');
const teams = simple('teams', 'teams');

const statuses = makeCrud({
  table: 'custom_statuses', entity: 'custom_statuses', module: 'settings',
  fields: ['context', 'name', 'color', 'sort_order', 'is_won', 'is_lost'],
  required: ['name'],
  searchFields: ['name'],
  filterFields: ['context'],
  orderBy: 't.sort_order, t.id',
});

// ------- Usuários (somente admin escreve; gestor lê) -------
const users = express.Router();

users.get('/', can('users', 'r'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.active, u.team_id, u.created_at, tm.name AS team_name
     FROM users u LEFT JOIN teams tm ON tm.id = u.team_id
     WHERE u.tenant_id = $1 ORDER BY u.name`, [req.user.tenantId]);
  res.json({ rows, total: rows.length, page: 1, pages: 1 });
});

users.post('/', can('users', 'rw'), async (req, res) => {
  const { name, email, role, phone, team_id, password } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ error: 'Nome, e-mail e perfil são obrigatórios' });
  if (!ROLE_PERMS[role]) return res.status(400).json({ error: 'Perfil inválido' });
  const hash = await bcrypt.hash(password || 'mudar123', 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, phone, team_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, role, phone, active, team_id`,
      [req.user.tenantId, name, email, hash, role, phone || null, team_id || null]);
    await logAudit({ req, entity: 'users', entityId: rows[0].id, action: 'create', after: rows[0] });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe usuário com este e-mail' });
    throw err;
  }
});

users.put('/:id', can('users', 'rw'), async (req, res) => {
  const { rows: beforeRows } = await query(
    `SELECT id, name, email, role, phone, active, team_id FROM users WHERE tenant_id = $1 AND id = $2`,
    [req.user.tenantId, req.params.id]);
  if (!beforeRows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  const { name, email, role, phone, team_id, active, password } = req.body || {};
  if (role && !ROLE_PERMS[role]) return res.status(400).json({ error: 'Perfil inválido' });
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($3, name), email = COALESCE($4, email), role = COALESCE($5, role),
       phone = COALESCE($6, phone), team_id = $7, active = COALESCE($8, active), updated_at = now()
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, name, email, role, phone, active, team_id`,
    [req.user.tenantId, req.params.id, name, email, role, phone,
      team_id === undefined ? beforeRows[0].team_id : team_id, active]);
  if (password) {
    await query('UPDATE users SET password_hash = $1 WHERE tenant_id = $2 AND id = $3',
      [await bcrypt.hash(password, 10), req.user.tenantId, req.params.id]);
  }
  await logAudit({ req, entity: 'users', entityId: rows[0].id, action: 'update', before: beforeRows[0], after: rows[0] });
  res.json(rows[0]);
});

users.delete('/:id', can('users', 'rw'), async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Não é possível excluir o próprio usuário; desative-o.' });
  }
  const { rows } = await query(
    `UPDATE users SET active = FALSE, updated_at = now()
     WHERE tenant_id = $1 AND id = $2 RETURNING id, name, email`,
    [req.user.tenantId, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  await logAudit({ req, entity: 'users', entityId: rows[0].id, action: 'desativado' });
  res.json({ ok: true, deactivated: true });
});

module.exports = { segments, sources, lossReasons, teams, statuses, users };
