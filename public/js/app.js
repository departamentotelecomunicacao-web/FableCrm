// Aplicação: autenticação, menu por perfil, roteamento e pesquisa global.
const App = {
  user: null,
  meta: { users: [], operators: [], plans: [], statuses: [], segments: [], sources: [], lossReasons: [], teams: [], companies: [], persons: [] },

  can(module, level = 'r') {
    const perm = (this.user?.permissions || {})[module];
    if (!perm) return false;
    return level === 'r' ? true : perm === 'rw';
  },

  MENU: [
    { section: '', items: [['dashboard', '📊 Dashboard', 'dashboard']] },
    {
      section: 'Comercial', items: [
        ['leads', '🎯 Leads', 'leads'],
        ['companies', '🏢 Empresas', 'companies'],
        ['persons', '👤 Pessoas Físicas', 'persons'],
        ['agenda', '📅 Agenda', 'agenda'],
        ['tasks', '✅ Tarefas', 'tasks'],
      ],
    },
    {
      section: 'Telefonia', items: [
        ['lines', '📱 Linhas', 'lines'],
        ['invoices', '🧾 Faturas', 'invoices'],
        ['analyses', '🔍 Auditoria de Faturas', 'analyses'],
        ['disputes', '⚖️ Contestações', 'disputes'],
        ['adjustments', '🔄 Readequações', 'adjustments'],
        ['telephony', '📡 Operadoras e Planos', 'telephony'],
      ],
    },
    {
      section: 'Gestão', items: [
        ['contracts', '📄 Contratos', 'contracts'],
        ['finance', '💰 Financeiro', 'finance'],
        ['documents', '🗂 Documentos', 'documents'],
        ['reports', '📈 Relatórios', 'reports'],
      ],
    },
    {
      section: 'Sistema', items: [
        ['settings', '⚙️ Configurações', 'settings'],
        ['audit', '🛡 Auditoria do Sistema', 'audit'],
      ],
    },
  ],

  async loadMeta() {
    this.meta = await API.get('/meta');
  },

  async start() {
    if (!API.token) return Views.login(document.getElementById('app'));
    try {
      const user = await API.get('/auth/me');
      this.boot(user);
    } catch {
      Views.login(document.getElementById('app'));
    }
  },

  async boot(user) {
    this.user = user;
    document.getElementById('app').innerHTML = `
      <div class="layout">
        <aside class="sidebar">
          <div class="brand"><img src="/icons/icon-192.png" alt=""><div><b>Fatura Expert</b><span>CRM</span></div></div>
          <nav class="menu"></nav>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-toggle" aria-label="Menu">☰</button>
            <div class="global-search">
              <input placeholder="🔎 Pesquisar cliente, CNPJ, CPF, linha, fatura…" aria-label="Pesquisa global">
              <div class="gs-results"></div>
            </div>
            <div class="topbar-right">
              <button class="icon-btn bell" title="Notificações">🔔<span class="bell-count" hidden></span></button>
              <div class="user-chip" title="${esc(user.email || '')}">
                <a href="#/profile"><b>${esc(user.name.split(' ')[0])}</b> <span class="muted">${esc({ admin: 'Administrador', gestor: 'Gestor', comercial: 'Comercial', analista: 'Analista', financeiro: 'Financeiro' }[user.role] || user.role)}</span></a>
                <button class="btn btn-outline btn-sm" data-logout>Sair</button>
              </div>
            </div>
          </header>
          <main id="view" class="content"></main>
        </div>
      </div>`;

    const nav = document.querySelector('.menu');
    nav.innerHTML = this.MENU.map((g) => {
      const items = g.items.filter(([, , mod]) => this.can(mod));
      if (!items.length) return '';
      return `${g.section ? `<div class="menu-section">${g.section}</div>` : ''}
        ${items.map(([route, lbl]) => `<a href="#/${route}" data-route="${route}">${lbl}</a>`).join('')}`;
    }).join('');

    document.querySelector('[data-logout]').onclick = () => {
      API.setToken(null);
      location.hash = '';
      location.reload();
    };
    document.querySelector('.menu-toggle').onclick = () =>
      document.querySelector('.sidebar').classList.toggle('open');
    nav.addEventListener('click', () => document.querySelector('.sidebar').classList.remove('open'));

    // Pesquisa global com sugestões.
    const gs = document.querySelector('.global-search input');
    const gsResults = document.querySelector('.gs-results');
    let deb;
    gs.addEventListener('input', () => {
      clearTimeout(deb);
      const q = gs.value.trim();
      if (q.length < 2) { gsResults.innerHTML = ''; return; }
      deb = setTimeout(async () => {
        try {
          const { results } = await API.get(`/search?q=${encodeURIComponent(q)}`);
          gsResults.innerHTML = results.slice(0, 8).map((r) => `
            <a href="#/${SEARCH_ROUTES[r.type] || 'dashboard'}">
              ${badge(SEARCH_LABELS[r.type] || r.type, '#4a3aa7')} <b>${esc(r.title)}</b>
              <span class="muted">${esc(r.subtitle || '')}</span></a>`).join('')
            || '<span class="muted gs-empty">Nada encontrado</span>';
        } catch { /* silencioso */ }
      }, 300);
    });
    gs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && gs.value.trim().length >= 2) {
        location.hash = `#/search/${encodeURIComponent(gs.value.trim())}`;
        gsResults.innerHTML = '';
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search')) gsResults.innerHTML = '';
    });

    document.querySelector('.bell').onclick = () => { location.hash = '#/notifications'; };

    try { await this.loadMeta(); } catch (err) { toast(err.message, 'err'); }
    this.refreshBell();
    setInterval(() => this.refreshBell(), 60000);

    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  async refreshBell() {
    try {
      const { unread } = await API.get('/notifications');
      const badgeEl = document.querySelector('.bell-count');
      if (!badgeEl) return;
      badgeEl.hidden = !unread;
      badgeEl.textContent = unread > 99 ? '99+' : unread;
    } catch { /* offline */ }
  },

  route() {
    const view = document.getElementById('view');
    if (!view) return;
    const hash = location.hash.replace(/^#\//, '') || 'dashboard';
    const [route, ...rest] = hash.split('/');

    document.querySelectorAll('.menu a').forEach((a) =>
      a.classList.toggle('active', a.dataset.route === route));

    if (route === 'search') return Views.searchResults(view, decodeURIComponent(rest.join('/')));
    if (route === 'notifications') return Views.notificationsPage(view);
    if (route === 'profile') return Views.profile(view);
    if (route === 'login') { location.hash = '#/dashboard'; return; }

    const modByRoute = { dashboard: 'dashboard', leads: 'leads', companies: 'companies', persons: 'persons', agenda: 'agenda', tasks: 'tasks', lines: 'lines', invoices: 'invoices', analyses: 'analyses', disputes: 'disputes', adjustments: 'adjustments', telephony: 'telephony', contracts: 'contracts', finance: 'finance', documents: 'documents', reports: 'reports', settings: 'settings', audit: 'audit' };
    if (!Views[route] || !this.can(modByRoute[route] || route)) {
      view.innerHTML = '<p class="muted" style="padding:24px">Página não encontrada ou sem permissão.</p>';
      return;
    }
    Views[route](view);
  },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* opcional */ }));
}
App.start();
