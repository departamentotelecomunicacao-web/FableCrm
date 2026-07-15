// Upload, listagem e download de documentos (contratos, procurações, faturas,
// relatórios, prints, comprovantes). Arquivos ficam em UPLOAD_DIR com nome
// aleatório; o download exige autenticação e respeita o tenant.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('../db');
const { can } = require('../middleware/auth');
const { logAudit } = require('../audit');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword', 'application/vnd.ms-excel', 'text/csv', 'text/plain',
]);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).slice(0, 10)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB || '20', 10)) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error('Tipo de arquivo não permitido'));
    cb(null, true);
  },
});

const router = express.Router();

router.get('/', can('documents', 'r'), async (req, res) => {
  const params = [req.user.tenantId];
  const where = ['d.tenant_id = $1'];
  for (const f of ['entity', 'entity_id', 'category']) {
    if (req.query[f]) { params.push(req.query[f]); where.push(`d.${f}::text = $${params.length}`); }
  }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`d.original_name ILIKE $${params.length}`); }
  const { rows } = await query(
    `SELECT d.*, u.name AS uploaded_by_name FROM documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT 300`, params);
  res.json({ rows, total: rows.length, page: 1, pages: 1 });
});

router.post('/', can('documents', 'rw'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const { entity, entity_id, category } = req.body;
  const { rows } = await query(
    `INSERT INTO documents (tenant_id, entity, entity_id, category, original_name, stored_name, mime, size, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.tenantId, entity || null, entity_id || null, category || 'outro',
      req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]);
  await logAudit({ req, entity: 'documents', entityId: rows[0].id, action: 'create', after: rows[0] });
  res.status(201).json(rows[0]);
});

router.get('/:id/download', can('documents', 'r'), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM documents WHERE tenant_id = $1 AND id = $2`, [req.user.tenantId, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Documento não encontrado' });
  const doc = rows[0];
  const file = path.join(UPLOAD_DIR, doc.stored_name);
  if (!fs.existsSync(file)) return res.status(410).json({ error: 'Arquivo não está mais disponível' });
  res.download(file, doc.original_name);
});

router.delete('/:id', can('documents', 'rw'), async (req, res) => {
  const { rows } = await query(
    `DELETE FROM documents WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [req.user.tenantId, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Documento não encontrado' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, rows[0].stored_name)); } catch { /* já removido */ }
  await logAudit({ req, entity: 'documents', entityId: rows[0].id, action: 'delete', before: rows[0] });
  res.json({ ok: true });
});

module.exports = router;
