const express = require('express');
const { query } = require('../db');
const { can } = require('../middleware/auth');

const router = express.Router();

router.get('/', can('notifications', 'r'), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications
     WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2)
     ORDER BY is_read, created_at DESC LIMIT 100`,
    [req.user.tenantId, req.user.id]);
  const unread = rows.filter((r) => !r.is_read).length;
  res.json({ rows, unread });
});

router.post('/read-all', can('notifications', 'rw'), async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2) AND NOT is_read`,
    [req.user.tenantId, req.user.id]);
  res.json({ ok: true });
});

router.post('/:id/read', can('notifications', 'rw'), async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE tenant_id = $1 AND id = $2`,
    [req.user.tenantId, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
