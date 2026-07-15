// Matriz de permissões por perfil.
// 'rw' = leitura e escrita, 'r' = somente leitura, ausência = sem acesso.
// A mesma matriz é enviada ao frontend (/api/auth/me) para montar o menu.

const ALL_MODULES = [
  'dashboard', 'companies', 'persons', 'leads', 'agenda', 'tasks',
  'telephony', 'lines', 'invoices', 'analyses', 'disputes', 'adjustments',
  'contracts', 'finance', 'documents', 'reports', 'search', 'notifications',
  'settings', 'users', 'audit',
];

const rw = (mods) => Object.fromEntries(mods.map((m) => [m, 'rw']));
const r = (mods) => Object.fromEntries(mods.map((m) => [m, 'r']));

const ROLE_PERMS = {
  admin: rw(ALL_MODULES),
  gestor: { ...rw(ALL_MODULES.filter((m) => m !== 'users')), users: 'r' },
  comercial: {
    ...rw(['dashboard', 'companies', 'persons', 'leads', 'agenda', 'tasks', 'documents', 'search', 'notifications']),
    ...r(['telephony', 'lines', 'contracts', 'reports']),
  },
  analista: {
    ...rw(['dashboard', 'telephony', 'lines', 'invoices', 'analyses', 'disputes', 'adjustments', 'documents', 'agenda', 'tasks', 'search', 'notifications']),
    ...r(['companies', 'persons', 'contracts', 'reports']),
  },
  financeiro: {
    ...rw(['dashboard', 'finance', 'invoices', 'contracts', 'documents', 'tasks', 'search', 'notifications']),
    ...r(['companies', 'persons', 'lines', 'telephony', 'reports']),
  },
};

function hasPermission(role, module, level = 'r') {
  const perm = (ROLE_PERMS[role] || {})[module];
  if (!perm) return false;
  return level === 'r' ? true : perm === 'rw';
}

module.exports = { ALL_MODULES, ROLE_PERMS, hasPermission };
