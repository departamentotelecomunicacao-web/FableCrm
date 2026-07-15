const jwt = require('jsonwebtoken');
const { hasPermission } = require('../permissions');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function sign(user) {
  return jwt.sign(
    { id: user.id, tenantId: user.tenant_id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '8h' }
  );
}

// Autentica via header Authorization: Bearer <token> (ou ?token= para downloads).
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

// Autorização por módulo/nível conforme perfil do usuário.
function can(module, level = 'r') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!hasPermission(req.user.role, module, level)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

module.exports = { sign, authenticate, can, JWT_SECRET };
