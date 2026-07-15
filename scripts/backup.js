// Backup do banco via pg_dump. Usado pelo cron interno (src/jobs.js) e por `npm run backup`.
require('dotenv').config();
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function runBackup() {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(process.env.BACKUP_DIR || './backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(dir, `fablecrm-${stamp}.sql.gz`);
    const url = process.env.DATABASE_URL;
    const child = execFile('sh', ['-c', `pg_dump "${url}" | gzip > "${file}"`], (err) => {
      if (err) return reject(err);
      pruneOld(dir);
      resolve(file);
    });
    child.on('error', reject);
  });
}

function pruneOld(dir) {
  const days = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  const cutoff = Date.now() - days * 86400000;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      if (f.startsWith('fablecrm-') && fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    } catch { /* arquivo removido em paralelo */ }
  }
}

module.exports = { runBackup };

if (require.main === module) {
  runBackup()
    .then((f) => console.log('Backup gerado:', f))
    .catch((e) => { console.error('Falha no backup:', e.message); process.exit(1); });
}
