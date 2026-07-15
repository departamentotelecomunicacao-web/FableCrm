const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { sign, authenticate } = require('../middleware/auth');
const { ROLE_PERMS } = require('../permissions');
const { logAudit } = require('../audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });
  const { rows } = await query(
    `SELECT u.*, t.name AS tenant_name FROM users u
     JOIN tenants t ON t.id = u.tenant_id AND t.active
     WHERE lower(u.email) = lower($1) AND u.active`, [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  }
  const token = sign(user);
  req.user = { id: user.id, tenantId: user.tenant_id, name: user.name, role: user.role };
  await logAudit({ req, entity: 'auth', entityId: user.id, action: 'login' });
  res.json({
    token,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      tenant: user.tenant_name, permissions: ROLE_PERMS[user.role],
    },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, t.name AS tenant
     FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`, [req.user.id]);
  if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' });
  res.json({ ...rows[0], permissions: ROLE_PERMS[rows[0].role] });
});

router.post('/change-password', authenticate, async (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next || next.length < 6) {
    return res.status(400).json({ error: 'Senha atual e nova (mín. 6 caracteres) são obrigatórias' });
  }
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(current, rows[0].password_hash))) {
    return res.status(400).json({ error: 'Senha atual incorreta' });
  }
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
    [await bcrypt.hash(next, 10), req.user.id]);
  await logAudit({ req, entity: 'users', entityId: req.user.id, action: 'senha_alterada' });
  res.json({ ok: true });
});

module.exports = router;
