// Contratos, financeiro, documentos, relatórios, configurações,
// registro de auditoria, notificações e pesquisa global.

Views.contracts = (container) => {
  resourceView(container, {
    title: 'Contratos', module: 'contracts', endpoint: '/contracts', itemLabel: 'Contrato', newLabel: 'Contrato',
    dateFilter: true,
    columns: [
      { key: 'type', label: 'Tipo', fmt: (v) => badge(label(v), '#4a3aa7') },
      { key: 'client_name', label: 'Cliente', fmt: (v) => `<b>${esc(v || '—')}</b>` },
      { key: 'start_date', label: 'Vigência', fmt: (v, r) => `${fmtDate(v)} → ${fmtDate(r.end_date)}${r.months ? `<br><span class="muted">${r.months} meses</span>` : ''}` },
      { key: 'value', label: 'Valor', fmt: fmtMoney },
      { key: 'renewal_type', label: 'Renovação', fmt: (v) => label(v) },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['ativo', 'encerrado', 'cancelado'] },
      { key: 'renewal_type', label: 'Renovação', options: ['automatica', 'manual'] },
    ],
    fields: [
      { key: 'type', label: 'Tipo', type: 'select', options: ['consultoria', 'auditoria', 'gestao', 'outro'].map((v) => ({ value: v, label: label(v) === v ? v[0].toUpperCase() + v.slice(1) : label(v) })), required: true, default: 'consultoria' },
      { key: 'contract_date', label: 'Data do contrato', type: 'date' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'start_date', label: 'Início da vigência', type: 'date' },
      { key: 'end_date', label: 'Fim da vigência', type: 'date' },
      { key: 'months', label: 'Duração (meses)', type: 'number', step: 1 },
      { key: 'value', label: 'Valor (R$)', type: 'money' },
      { key: 'renewal_type', label: 'Renovação', type: 'select', options: ['automatica', 'manual'], default: 'manual' },
      { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'encerrado', 'cancelado'], default: 'ativo' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      { icon: '📎', label: 'Anexar contrato', onClick: (row) => docsModal('contracts', row.id, `Anexos do contrato #${row.id}`) },
    ],
  });
};

Views.finance = (container) => {
  container.innerHTML = `
    <div class="tabs"><button class="tab active" data-t="rev">Receitas</button>
    <button class="tab" data-t="com">Comissões</button></div>
    <div class="tab-body"></div>`;
  const body = container.querySelector('.tab-body');

  const renderRevenues = () => resourceView(body, {
    title: 'Receitas', module: 'finance', endpoint: '/revenues', itemLabel: 'Receita', newLabel: 'Receita',
    dateFilter: true,
    columns: [
      { key: 'client_name', label: 'Cliente', fmt: (v, r) => `<b>${esc(v || '—')}</b>${r.description ? `<br><span class="muted">${esc(r.description)}</span>` : ''}` },
      { key: 'amount', label: 'Valor', fmt: fmtMoney },
      { key: 'due_date', label: 'Vencimento', fmt: fmtDate },
      { key: 'paid_at', label: 'Pagamento', fmt: fmtDate },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [{ key: 'status', label: 'Status', options: ['pendente', 'paga', 'atrasada', 'cancelada'] }],
    fields: [
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'description', label: 'Descrição' },
      { key: 'amount', label: 'Valor (R$)', type: 'money', required: true },
      { key: 'due_date', label: 'Vencimento', type: 'date' },
      { key: 'paid_at', label: 'Pagamento', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['pendente', 'paga', 'atrasada', 'cancelada'], default: 'pendente' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      {
        icon: '✔', label: 'Marcar como paga', show: (r) => ['pendente', 'atrasada'].includes(r.status) && App.can('finance', 'rw'),
        onClick: async (row, reload) => { await API.put(`/revenues/${row.id}`, { paid_at: new Date().toISOString().slice(0, 10), status: 'paga' }); toast('Receita baixada'); reload(); },
      },
    ],
  });

  const renderCommissions = () => resourceView(body, {
    title: 'Comissões dos Consultores', module: 'finance', endpoint: '/commissions', itemLabel: 'Comissão', newLabel: 'Comissão',
    columns: [
      { key: 'consultant_name', label: 'Consultor', fmt: (v) => `<b>${esc(v)}</b>` },
      { key: 'reference_month', label: 'Referência' },
      { key: 'base_amount', label: 'Base', fmt: fmtMoney },
      { key: 'percent', label: '%', fmt: (v) => v ? `${Number(v).toLocaleString('pt-BR')}%` : '—' },
      { key: 'amount', label: 'Comissão', fmt: (v) => `<b>${fmtMoney(v)}</b>` },
      { key: 'status', label: 'Status', fmt: statusBadge },
      { key: 'paid_at', label: 'Pagamento', fmt: fmtDate },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['pendente', 'paga'] },
      { key: 'consultant_id', label: 'Consultor', options: 'users' },
    ],
    fields: [
      { key: 'consultant_id', label: 'Consultor', type: 'select', options: 'users', required: true },
      { key: 'reference_month', label: 'Mês de referência', type: 'month' },
      { key: 'base_amount', label: 'Valor base (R$)', type: 'money' },
      { key: 'percent', label: 'Percentual (%)', type: 'number', step: 0.01 },
      { key: 'amount', label: 'Valor da comissão (R$)', type: 'money' },
      { key: 'status', label: 'Status', type: 'select', options: ['pendente', 'paga'], default: 'pendente' },
      { key: 'paid_at', label: 'Pagamento', type: 'date' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
  });

  container.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => {
    container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    tab.dataset.t === 'rev' ? renderRevenues() : renderCommissions();
  });
  renderRevenues();
};

Views.documents = (container) => {
  const canWrite = App.can('documents', 'rw');
  container.innerHTML = `
    <div class="page-head"><h2>Documentos</h2>
      ${canWrite ? `<div class="docs-upload">
        <select class="doc-cat">${['contrato', 'procuracao', 'fatura', 'relatorio', 'print', 'comprovante', 'outro'].map((c) => `<option value="${c}">${label(c)}</option>`).join('')}</select>
        <input type="file" class="doc-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.doc,.xls,.csv,.txt">
        <button class="btn btn-primary">Enviar</button></div>` : ''}
    </div>
    <div class="toolbar">
      <input class="search" placeholder="Pesquisar por nome do arquivo…">
      <select class="cat-filter"><option value="">Categoria: todas</option>
        ${['contrato', 'procuracao', 'fatura', 'relatorio', 'print', 'comprovante', 'outro'].map((c) => `<option value="${c}">${label(c)}</option>`).join('')}</select>
    </div>
    <div class="docs-page muted">Carregando…</div>`;

  const listEl = container.querySelector('.docs-page');
  const state = { q: '', category: '' };
  let rows = [];
  const load = async () => {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    rows = (await API.get(`/documents?${p}`)).rows;
    listEl.classList.remove('muted');
    listEl.innerHTML = rows.length ? rows.map((d) => `
      <div class="doc-row" data-id="${d.id}">
        <span class="badge" style="--bc:#0ea5e9">${esc(label(d.category))}</span>
        <span class="doc-name">${esc(d.original_name)}</span>
        <span class="muted">${d.entity ? esc(d.entity) + (d.entity_id ? ' #' + d.entity_id : '') + ' • ' : ''}${(d.size / 1024).toFixed(0)} KB • ${fmtDate(d.created_at)} • ${esc(d.uploaded_by_name || '')}</span>
        <button class="icon-btn" data-dl title="Baixar">⬇</button>
        ${canWrite ? '<button class="icon-btn" data-del title="Excluir">🗑</button>' : ''}
      </div>`).join('') : '<p class="muted">Nenhum documento encontrado.</p>';
  };
  listEl.addEventListener('click', async (e) => {
    const row = rows.find((r) => String(r.id) === e.target.closest('[data-id]')?.dataset.id);
    if (!row) return;
    try {
      if (e.target.closest('[data-dl]')) await API.download(`/documents/${row.id}/download`, row.original_name);
      if (e.target.closest('[data-del]') && await confirmDialog('Excluir este documento?')) { await API.del(`/documents/${row.id}`); load(); }
    } catch (err) { toast(err.message, 'err'); }
  });
  let deb;
  container.querySelector('.search').addEventListener('input', (e) => {
    clearTimeout(deb); deb = setTimeout(() => { state.q = e.target.value; load(); }, 350);
  });
  container.querySelector('.cat-filter').addEventListener('change', (e) => { state.category = e.target.value; load(); });
  const upBtn = container.querySelector('.docs-upload .btn');
  if (upBtn) upBtn.onclick = async () => {
    const file = container.querySelector('.doc-file').files[0];
    if (!file) return toast('Selecione um arquivo', 'err');
    try {
      await API.upload('/documents', file, { category: container.querySelector('.doc-cat').value });
      container.querySelector('.doc-file').value = '';
      toast('Documento enviado');
      load();
    } catch (err) { toast(err.message, 'err'); }
  };
  load().catch((err) => { listEl.textContent = err.message; });
};

Views.reports = async (container) => {
  let types;
  try { types = await API.get('/reports'); } catch (err) { container.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }
  container.innerHTML = `
    <div class="page-head"><h2>Relatórios</h2></div>
    <div class="toolbar report-toolbar">
      <select class="rep-type">${types.map((t) => `<option value="${t.key}">${esc(t.title)}</option>`).join('')}</select>
      <label>De <input type="date" class="rep-from"></label>
      <label>Até <input type="date" class="rep-to"></label>
      <button class="btn btn-primary rep-run">Gerar</button>
      <button class="btn btn-outline rep-xlsx">⬇ Excel</button>
      <button class="btn btn-outline rep-pdf">⬇ PDF</button>
    </div>
    <div class="card rep-result"><p class="muted">Escolha um relatório e clique em Gerar.</p></div>`;

  const params = () => {
    const p = new URLSearchParams();
    const from = container.querySelector('.rep-from').value;
    const to = container.querySelector('.rep-to').value;
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  };
  const type = () => container.querySelector('.rep-type').value;

  container.querySelector('.rep-run').onclick = async () => {
    const result = container.querySelector('.rep-result');
    result.innerHTML = '<p class="muted">Gerando…</p>';
    try {
      const p = params(); p.set('format', 'json');
      const data = await API.get(`/reports/${type()}?${p}`);
      const isMoney = (k) => /amount|value|valor|savings|recovered|commissions|economia/i.test(k);
      const isDate = (k) => /date|_at$/.test(k) && !/status/.test(k);
      result.innerHTML = `
        <h3>${esc(data.title)} <span class="muted">${esc(data.period)} · ${data.rows.length} registro(s)</span></h3>
        <div class="table-wrap"><table class="table">
          <thead><tr>${data.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${data.rows.map((r) => `<tr>${data.columns.map((c) => {
    const v = r[c.key];
    if (v == null) return '<td>—</td>';
    if (isMoney(c.key) && !isNaN(Number(v))) return `<td>${fmtMoney(v)}</td>`;
    if (isDate(c.key)) return `<td>${fmtDate(v)}</td>`;
    return `<td>${esc(v)}</td>`;
  }).join('')}</tr>`).join('') || `<tr><td colspan="${data.columns.length}" class="muted empty">Sem registros no período.</td></tr>`}</tbody>
        </table></div>`;
    } catch (err) { result.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  };
  container.querySelector('.rep-xlsx').onclick = () => {
    const p = params(); p.set('format', 'xlsx');
    API.download(`/reports/${type()}?${p}`, `${type()}.xlsx`).catch((e) => toast(e.message, 'err'));
  };
  container.querySelector('.rep-pdf').onclick = () => {
    const p = params(); p.set('format', 'pdf');
    API.download(`/reports/${type()}?${p}`, `${type()}.pdf`).catch((e) => toast(e.message, 'err'));
  };
};

// ------------------- Configurações -------------------

Views.settings = (container) => {
  const isAdmin = App.user.role === 'admin';
  const tabs = [
    ['users', 'Usuários'], ['teams', 'Equipes'], ['segments', 'Segmentos'],
    ['sources', 'Origens de lead'], ['loss', 'Motivos de perda'], ['statuses', 'Status do funil'],
    ...(isAdmin ? [['backup', 'Backup']] : []),
  ];
  container.innerHTML = `
    <div class="tabs">${tabs.map(([k, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="tab-body"></div>`;
  const body = container.querySelector('.tab-body');

  const simpleCrud = (endpoint, title, itemLabel) => () => resourceView(body, {
    title, module: 'settings', endpoint, itemLabel,
    columns: [{ key: 'name', label: 'Nome' }],
    fields: [{ key: 'name', label: 'Nome', required: true, full: true }],
  });

  const renderers = {
    users: () => resourceView(body, {
      title: 'Usuários', module: 'users', endpoint: '/users', itemLabel: 'Usuário', searchable: false,
      columns: [
        { key: 'name', label: 'Nome', fmt: (v) => `<b>${esc(v)}</b>` },
        { key: 'email', label: 'E-mail' },
        { key: 'role', label: 'Perfil', fmt: (v) => badge(label(v), '#4a3aa7') },
        { key: 'team_name', label: 'Equipe' },
        { key: 'active', label: 'Situação', fmt: (v) => v ? badge('Ativo', '#008300') : badge('Inativo', '#94a3b8') },
      ],
      fields: [
        { key: 'name', label: 'Nome', required: true },
        { key: 'email', label: 'E-mail', required: true },
        { key: 'role', label: 'Perfil', type: 'select', options: ['admin', 'gestor', 'comercial', 'analista', 'financeiro'], required: true },
        { key: 'phone', label: 'Telefone' },
        { key: 'team_id', label: 'Equipe', type: 'select', options: 'teams' },
        { key: 'password', label: 'Senha (deixe em branco para manter)', type: 'password' },
        { key: 'active', label: 'Ativo', type: 'checkbox', default: true },
      ],
      canDelete: false,
      onSaved: () => App.loadMeta(),
    }),
    teams: simpleCrud('/teams', 'Equipes', 'Equipe'),
    segments: simpleCrud('/segments', 'Segmentos', 'Segmento'),
    sources: simpleCrud('/sources', 'Origens de lead', 'Origem'),
    loss: simpleCrud('/loss-reasons', 'Motivos de perda', 'Motivo'),
    statuses: () => resourceView(body, {
      title: 'Status do funil', module: 'settings', endpoint: '/statuses', itemLabel: 'Status',
      defaultQuery: { context: 'lead' },
      columns: [
        { key: 'sort_order', label: 'Ordem' },
        { key: 'name', label: 'Nome', fmt: (v, r) => badge(v, r.color) },
        { key: 'color', label: 'Cor' },
        { key: 'is_won', label: 'Ganho', fmt: (v) => v ? '✔' : '—' },
        { key: 'is_lost', label: 'Perdido', fmt: (v) => v ? '✔' : '—' },
      ],
      fields: [
        { key: 'name', label: 'Nome', required: true },
        { key: 'color', label: 'Cor (hex)', default: '#64748b' },
        { key: 'sort_order', label: 'Ordem', type: 'number', step: 1 },
        { key: 'is_won', label: 'Representa negócio ganho', type: 'checkbox' },
        { key: 'is_lost', label: 'Representa negócio perdido', type: 'checkbox' },
      ],
      onSaved: () => App.loadMeta(),
    }),
    backup: async () => {
      body.innerHTML = `<div class="card">
        <h3>Backup do banco de dados</h3>
        <p class="muted">Backups automáticos diários via <code>pg_dump</code> (cron configurável no .env). Retenção: ${'30 dias por padrão'}.</p>
        <button class="btn btn-primary" data-run>Gerar backup agora</button>
        <div class="backup-list" style="margin-top:16px"><p class="muted">Carregando…</p></div></div>`;
      const list = body.querySelector('.backup-list');
      const load = async () => {
        try {
          const files = await API.get('/admin/backups');
          list.innerHTML = files.length ? files.map((f) => `
            <div class="doc-row"><span class="doc-name">${esc(f.name)}</span>
            <span class="muted">${(f.size / 1024).toFixed(0)} KB • ${fmtDateTime(f.mtime)}</span></div>`).join('')
            : '<p class="muted">Nenhum backup gerado ainda.</p>';
        } catch (err) { list.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
      };
      body.querySelector('[data-run]').onclick = async (e) => {
        e.target.disabled = true;
        try { await API.post('/admin/backup'); toast('Backup gerado'); load(); }
        catch (err) { toast(err.message, 'err'); }
        e.target.disabled = false;
      };
      load();
    },
  };

  container.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => {
    container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    renderers[tab.dataset.t]();
  });
  renderers[tabs[0][0]]();
};

Views.audit = (container) => {
  container.innerHTML = `
    <div class="page-head"><h2>Auditoria do Sistema</h2></div>
    <div class="toolbar">
      <select class="a-entity"><option value="">Módulo: todos</option>
        ${['companies', 'persons', 'leads', 'agenda_events', 'tasks', 'phone_lines', 'invoices', 'audit_analyses', 'disputes', 'plan_adjustments', 'contracts', 'revenues', 'commissions', 'documents', 'users', 'auth', 'reports', 'backup'].map((e) => `<option>${e}</option>`).join('')}</select>
      <select class="a-user"><option value="">Usuário: todos</option>
        ${App.meta.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
      <input type="date" class="a-from"> <input type="date" class="a-to">
    </div>
    <div class="card a-list"><p class="muted">Carregando…</p></div>
    <div class="pagination a-pag"></div>`;

  const state = { page: 1 };
  const load = async () => {
    const p = new URLSearchParams({ page: state.page, limit: 30 });
    for (const [sel, key] of [['.a-entity', 'entity'], ['.a-user', 'user_id'], ['.a-from', 'from'], ['.a-to', 'to']]) {
      const v = container.querySelector(sel).value;
      if (v) p.set(key, v);
    }
    let data;
    try { data = await API.get(`/audit-log?${p}`); } catch (err) {
      container.querySelector('.a-list').innerHTML = `<p class="muted">${esc(err.message)}</p>`; return;
    }
    container.querySelector('.a-list').innerHTML = data.rows.length ? data.rows.map((r) => `
      <div class="history-item">
        <div class="history-head"><b>${esc(r.user_name || 'Sistema')}</b>
          <span class="badge" style="--bc:#6366f1">${esc(label(r.action))}</span>
          <span class="badge" style="--bc:#64748b">${esc(r.entity)}${r.entity_id ? ' #' + r.entity_id : ''}</span>
          <span class="muted">${fmtDateTime(r.created_at)}${r.ip ? ' • IP ' + esc(r.ip) : ''}</span></div>
        ${r.changes ? `<ul>${Object.entries(r.changes).slice(0, 8).map(([k, c]) =>
    `<li><b>${esc(k)}</b>: ${esc(c.de ?? 'vazio')} → ${esc(c.para ?? 'vazio')}</li>`).join('')}</ul>` : ''}
      </div>`).join('') : '<p class="muted">Nenhum registro.</p>';
    container.querySelector('.a-pag').innerHTML = data.pages > 1 ? `
      <button class="btn btn-outline btn-sm" data-pg="-1" ${data.page <= 1 ? 'disabled' : ''}>‹</button>
      <span>Página ${data.page} de ${data.pages}</span>
      <button class="btn btn-outline btn-sm" data-pg="1" ${data.page >= data.pages ? 'disabled' : ''}>›</button>` : '';
  };
  container.querySelectorAll('.toolbar select, .toolbar input').forEach((i) =>
    i.addEventListener('change', () => { state.page = 1; load(); }));
  container.querySelector('.a-pag').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]');
    if (b) { state.page += Number(b.dataset.pg); load(); }
  });
  load();
};

Views.notificationsPage = async (container) => {
  container.innerHTML = `<div class="page-head"><h2>Notificações</h2>
    <button class="btn btn-outline" data-all>Marcar todas como lidas</button></div>
    <div class="card n-list"><p class="muted">Carregando…</p></div>`;
  const load = async () => {
    const { rows } = await API.get('/notifications');
    container.querySelector('.n-list').innerHTML = rows.length ? rows.map((n) => `
      <div class="notif ${n.is_read ? 'read' : ''}" data-id="${n.id}">
        ${badge(label(n.type === 'vencimento' ? 'vencimento' : n.type) === n.type ? n.type.replace('_', '-') : label(n.type), n.is_read ? '#94a3b8' : '#eb6834')}
        <div><b>${esc(n.title)}</b><p class="muted">${esc(n.message || '')}</p></div>
        <span class="muted">${fmtDateTime(n.created_at)}</span>
        ${!n.is_read ? '<button class="icon-btn" data-read title="Marcar como lida">✔</button>' : ''}
      </div>`).join('') : '<p class="muted">Nenhuma notificação.</p>';
    App.refreshBell();
  };
  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-all]')) { await API.post('/notifications/read-all'); load(); }
    const r = e.target.closest('[data-read]');
    if (r) { await API.post(`/notifications/${r.closest('.notif').dataset.id}/read`); load(); }
  });
  load().catch((err) => { container.querySelector('.n-list').innerHTML = `<p class="muted">${esc(err.message)}</p>`; });
};

const SEARCH_ROUTES = { company: 'companies', person: 'persons', line: 'lines', invoice: 'invoices', lead: 'leads' };
const SEARCH_LABELS = { company: 'Empresa', person: 'Pessoa', line: 'Linha', invoice: 'Fatura', lead: 'Lead' };

Views.searchResults = async (container, q) => {
  container.innerHTML = `<div class="page-head"><h2>Pesquisa: “${esc(q)}”</h2></div><div class="card s-list"><p class="muted">Buscando…</p></div>`;
  try {
    const { results } = await API.get(`/search?q=${encodeURIComponent(q)}`);
    container.querySelector('.s-list').innerHTML = results.length ? results.map((r) => `
      <a class="search-row" href="#/${SEARCH_ROUTES[r.type] || 'dashboard'}">
        ${badge(SEARCH_LABELS[r.type] || r.type, '#4a3aa7')}
        <b>${esc(r.title)}</b><span class="muted">${esc(r.subtitle || '')}</span></a>`).join('')
      : '<p class="muted">Nada encontrado para esta pesquisa.</p>';
  } catch (err) {
    container.querySelector('.s-list').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
};

Views.profile = (container) => {
  container.innerHTML = `<div class="page-head"><h2>Meu Perfil</h2></div>
    <div class="card" style="max-width:480px">
      <p><b>${esc(App.user.name)}</b> — ${label(App.user.role)}<br><span class="muted">${esc(App.user.email || '')} · ${esc(App.user.tenant || '')}</span></p>
      <h3 style="margin-top:16px">Alterar senha</h3>
      <form class="form-grid">
        <div class="field full"><label>Senha atual</label><input type="password" name="current" required autocomplete="current-password"></div>
        <div class="field full"><label>Nova senha (mín. 6 caracteres)</label><input type="password" name="next" required minlength="6" autocomplete="new-password"></div>
        <div class="form-actions full"><button class="btn btn-primary">Alterar senha</button></div>
      </form></div>`;
  container.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/change-password', {
        current: container.querySelector('[name=current]').value,
        next: container.querySelector('[name=next]').value,
      });
      toast('Senha alterada com sucesso');
      e.target.reset();
    } catch (err) { toast(err.message, 'err'); }
  };
};
