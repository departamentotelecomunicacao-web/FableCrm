// Rotas administrativas: backup manual e listagem de backups (somente admin).
const express = require('express');
const fs = require('fs');
const path = require('path');
const { can } = require('../middleware/auth');
const { logAudit } = require('../audit');
const { runBackup } = require('../../scripts/backup');
const { generateNotifications } = require('../jobs');

const router = express.Router();

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores' });
  next();
};

router.post('/backup', can('settings', 'rw'), adminOnly, async (req, res) => {
  const file = await runBackup();
  await logAudit({ req, entity: 'backup', entityId: null, action: 'backup_manual' });
  res.json({ ok: true, file: path.basename(file) });
});

router.get('/backups', can('settings', 'r'), adminOnly, async (req, res) => {
  const dir = path.resolve(process.env.BACKUP_DIR || './backups');
  let files = [];
  if (fs.existsSync(dir)) {
    files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('fablecrm-'))
      .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size, mtime: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
  }
  res.json(files);
});

router.post('/run-notifications', can('settings', 'rw'), adminOnly, async (req, res) => {
  await generateNotifications();
  res.json({ ok: true });
});

module.exports = router;
