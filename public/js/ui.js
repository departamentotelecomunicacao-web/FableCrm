// Componentes de UI: helpers de formatação, toasts, modais, formulários
// dinâmicos e a visão genérica de recurso (lista + filtros + CRUD + histórico).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const fmtMoney = (v) => v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (v) => !v ? '—' : new Date(String(v).length === 10 ? v + 'T12:00' : v).toLocaleDateString('pt-BR');
const fmtDateTime = (v) => !v ? '—' : new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const badge = (text, color = '#64748b') => text ? `<span class="badge" style="--bc:${color}">${esc(text)}</span>` : '—';

const LABELS = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
  paga: 'Paga', atrasada: 'Atrasada', contestada: 'Contestada',
  ativa: 'Ativa', suspensa: 'Suspensa', portada: 'Portada',
  ativo: 'Ativo', inativo: 'Inativo', prospect: 'Prospect',
  aberta: 'Aberta', finalizada: 'Finalizada', aprovada: 'Aprovada', negada: 'Negada', parcial: 'Parcial',
  proposta: 'Proposta', implantada: 'Implantada',
  baixa: 'Baixa', media: 'Média', alta: 'Alta',
  encerrado: 'Encerrado', cancelado: 'Cancelado',
  automatica: 'Automática', manual: 'Manual',
  reuniao: 'Reunião', ligacao: 'Ligação', retorno: 'Retorno', follow_up: 'Follow-up', compromisso: 'Compromisso',
  movel: 'Móvel', fixa: 'Fixa', fibra: 'Fibra', tv: 'TV', link_dedicado: 'Link dedicado', m2m_iot: 'M2M/IoT',
  admin: 'Administrador', gestor: 'Gestor', comercial: 'Comercial', analista: 'Analista', financeiro: 'Financeiro',
  consultoria: 'Consultoria', auditoria: 'Auditoria',
  contrato: 'Contrato', procuracao: 'Procuração', fatura: 'Fatura', relatorio: 'Relatório',
  print: 'Print', comprovante: 'Comprovante', outro: 'Outro',
  create: 'Criação', update: 'Alteração', delete: 'Exclusão', login: 'Login',
};
const label = (v) => LABELS[v] || v || '—';

const STATUS_COLORS = {
  pendente: '#f59e0b', em_andamento: '#3b82f6', concluida: '#22c55e', cancelada: '#94a3b8',
  paga: '#22c55e', atrasada: '#ef4444', contestada: '#8b5cf6',
  ativa: '#22c55e', suspensa: '#f59e0b', portada: '#8b5cf6',
  ativo: '#22c55e', inativo: '#94a3b8', prospect: '#3b82f6',
  aberta: '#f59e0b', finalizada: '#22c55e', aprovada: '#22c55e', negada: '#ef4444', parcial: '#f59e0b',
  proposta: '#3b82f6', implantada: '#22c55e',
  baixa: '#94a3b8', media: '#f59e0b', alta: '#ef4444',
  encerrado: '#94a3b8', cancelado: '#ef4444',
};
const statusBadge = (v) => badge(label(v), STATUS_COLORS[v]);

function toast(msg, type = 'ok') {
  const t = el(`<div class="toast toast-${type}">${esc(msg)}</div>`);
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3800);
}

function modal(title, bodyEl, { wide = false } = {}) {
  const back = el(`<div class="modal-back">
    <div class="modal ${wide ? 'modal-wide' : ''}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal-body"></div>
    </div></div>`);
  back.querySelector('.modal-body').appendChild(bodyEl);
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.hasAttribute('data-close')) close(); });
  document.body.appendChild(back);
  return { close, root: back };
}

function confirmDialog(msg) {
  return new Promise((resolve) => {
    const body = el(`<div><p style="margin-bottom:16px">${esc(msg)}</p>
      <div class="form-actions"><button class="btn btn-outline" data-no>Cancelar</button>
      <button class="btn btn-danger" data-yes>Confirmar</button></div></div>`);
    const m = modal('Confirmação', body);
    body.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
    body.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
  });
}

// ------------------- Formulários dinâmicos -------------------

function optionsFor(spec, current) {
  let opts = spec.options;
  if (typeof opts === 'string') {
    const meta = App.meta[opts] || [];
    opts = meta
      .filter((o) => (opts === 'statuses' ? o.context === (spec.statusContext || 'lead') : true))
      .map((o) => ({ value: o.id, label: o.name }));
  } else if (Array.isArray(opts) && typeof opts[0] === 'string') {
    opts = opts.map((v) => ({ value: v, label: label(v) }));
  }
  return (opts || []).map((o) =>
    `<option value="${esc(o.value)}" ${String(current) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
}

function fieldHtml(f, values) {
  let v = values[f.key];
  if (v == null) v = f.default != null ? f.default : '';
  const req = f.required ? 'required' : '';
  const name = `name="${f.key}"`;
  let input;
  switch (f.type) {
    case 'textarea':
      input = `<textarea ${name} rows="3">${esc(v)}</textarea>`; break;
    case 'select':
      input = `<select ${name} ${req}><option value="">—</option>${optionsFor(f, v)}</select>`; break;
    case 'checkbox':
      return `<label class="field field-check ${f.full ? 'full' : ''}">
        <input type="checkbox" ${name} ${v === true || v === 'true' ? 'checked' : ''}> <span>${esc(f.label)}</span></label>`;
    case 'checkboxes': { // grupo de múltipla escolha (ex.: serviços da operadora)
      const set = new Set(Array.isArray(v) ? v : []);
      return `<div class="field full"><label>${esc(f.label)}</label><div class="check-group">
        ${f.options.map((o) => `<label class="chip-check"><input type="checkbox" data-group="${f.key}" value="${o}" ${set.has(o) ? 'checked' : ''}>${label(o)}</label>`).join('')}
      </div></div>`;
    }
    case 'number':
      input = `<input type="number" step="${f.step || 'any'}" ${name} value="${esc(v)}" ${req}>`; break;
    case 'money':
      input = `<input type="number" step="0.01" min="0" ${name} value="${esc(v)}" ${req}>`; break;
    case 'date':
      input = `<input type="date" ${name} value="${esc(String(v).slice(0, 10))}" ${req}>`; break;
    case 'datetime': {
      let local = '';
      if (v) { const d = new Date(v); local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      input = `<input type="datetime-local" ${name} value="${local}" ${req}>`; break;
    }
    case 'month':
      input = `<input type="month" ${name} value="${esc(String(v).slice(0, 7))}" ${req}>`; break;
    case 'password':
      input = `<input type="password" ${name} ${req} autocomplete="new-password">`; break;
    default:
      input = `<input type="text" ${name} value="${esc(v)}" ${req}>`;
  }
  return `<div class="field ${f.full ? 'full' : ''}"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${input}</div>`;
}

function formEl(fields, values = {}, submitLabel = 'Salvar') {
  const form = el(`<form class="form-grid">
    ${fields.map((f) => fieldHtml(f, values)).join('')}
    <div class="form-actions full">
      <button type="button" class="btn btn-outline" data-close>Cancelar</button>
      <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
    </div></form>`);
  return form;
}

function readForm(form, fields) {
  const data = {};
  for (const f of fields) {
    if (f.type === 'checkbox') {
      data[f.key] = form.querySelector(`[name="${f.key}"]`).checked;
    } else if (f.type === 'checkboxes') {
      data[f.key] = [...form.querySelectorAll(`[data-group="${f.key}"]:checked`)].map((i) => i.value);
    } else if (f.type === 'datetime') {
      const v = form.querySelector(`[name="${f.key}"]`).value;
      data[f.key] = v ? new Date(v).toISOString() : '';
    } else {
      data[f.key] = form.querySelector(`[name="${f.key}"]`).value;
    }
  }
  return data;
}

// ------------------- Histórico, comentários e documentos -------------------

async function historyModal(endpoint, id, fieldLabels = {}) {
  const rows = await API.get(`${endpoint}/${id}/history`);
  const flabel = (k) => fieldLabels[k] || k;
  const fval = (v) => v == null || v === '' ? '<i>vazio</i>' : esc(typeof v === 'object' ? JSON.stringify(v) : v);
  const body = el(`<div class="history">
    ${rows.length ? rows.map((r) => `
      <div class="history-item">
        <div class="history-head"><b>${esc(r.user_name || 'Sistema')}</b>
          <span class="badge" style="--bc:#6366f1">${esc(label(r.action))}</span>
          <span class="muted">${fmtDateTime(r.created_at)}</span></div>
        ${r.changes ? `<ul>${Object.entries(r.changes).map(([k, c]) =>
    `<li><b>${esc(flabel(k))}</b>: ${fval(c.de)} → ${fval(c.para)}</li>`).join('')}</ul>` : ''}
      </div>`).join('') : '<p class="muted">Sem histórico registrado.</p>'}
  </div>`);
  modal('Histórico de alterações', body, { wide: true });
}

function commentsBox(endpoint, id) {
  const box = el(`<div class="comments">
    <div class="comments-list muted">Carregando…</div>
    <form class="comments-form"><input placeholder="Escreva um comentário…" required>
    <button class="btn btn-primary btn-sm">Enviar</button></form></div>`);
  const list = box.querySelector('.comments-list');
  const load = async () => {
    const rows = await API.get(`${endpoint}/${id}/comments`);
    list.classList.remove('muted');
    list.innerHTML = rows.length ? rows.map((c) => `
      <div class="comment"><b>${esc(c.user_name || '—')}</b>
      <span class="muted">${fmtDateTime(c.created_at)}</span><p>${esc(c.body)}</p></div>`).join('')
      : '<p class="muted">Nenhum comentário ainda.</p>';
  };
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const input = box.querySelector('input');
    try {
      await API.post(`${endpoint}/${id}/comments`, { body: input.value });
      input.value = '';
      load();
    } catch (err) { toast(err.message, 'err'); }
  };
  load().catch(() => { list.textContent = 'Erro ao carregar comentários.'; });
  return box;
}

function docsModal(entity, entityId, title = 'Documentos') {
  const body = el(`<div>
    <div class="docs-list muted">Carregando…</div>
    <div class="docs-upload">
      <select class="doc-cat">${['contrato', 'procuracao', 'fatura', 'relatorio', 'print', 'comprovante', 'outro']
    .map((c) => `<option value="${c}">${label(c)}</option>`).join('')}</select>
      <input type="file" class="doc-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.doc,.xls,.csv,.txt">
      <button class="btn btn-primary btn-sm">Enviar</button>
    </div></div>`);
  const list = body.querySelector('.docs-list');
  const canWrite = App.can('documents', 'rw');
  const load = async () => {
    const { rows } = await API.get(`/documents?entity=${entity}&entity_id=${entityId}`);
    list.classList.remove('muted');
    list.innerHTML = rows.length ? rows.map((d) => `
      <div class="doc-row">
        <span class="badge" style="--bc:#0ea5e9">${esc(label(d.category))}</span>
        <span class="doc-name">${esc(d.original_name)}</span>
        <span class="muted">${(d.size / 1024).toFixed(0)} KB • ${fmtDate(d.created_at)}</span>
        <button class="icon-btn" data-dl="${d.id}" data-name="${esc(d.original_name)}" title="Baixar">⬇</button>
        ${canWrite ? `<button class="icon-btn" data-del="${d.id}" title="Excluir">🗑</button>` : ''}
      </div>`).join('') : '<p class="muted">Nenhum documento anexado.</p>';
  };
  body.addEventListener('click', async (e) => {
    const dl = e.target.closest('[data-dl]');
    const del = e.target.closest('[data-del]');
    try {
      if (dl) await API.download(`/documents/${dl.dataset.dl}/download`, dl.dataset.name);
      if (del && await confirmDialog('Excluir este documento?')) { await API.del(`/documents/${del.dataset.del}`); load(); }
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('.btn').onclick = async () => {
    const file = body.querySelector('.doc-file').files[0];
    if (!file) return toast('Selecione um arquivo', 'err');
    try {
      await API.upload('/documents', file, { entity, entity_id: entityId, category: body.querySelector('.doc-cat').value });
      body.querySelector('.doc-file').value = '';
      toast('Documento enviado');
      load();
    } catch (err) { toast(err.message, 'err'); }
  };
  if (!canWrite) body.querySelector('.docs-upload').style.display = 'none';
  load().catch(() => { list.textContent = 'Erro ao carregar documentos.'; });
  modal(title, body, { wide: true });
}

// ------------------- Visão genérica de recurso -------------------

function resourceView(container, cfg) {
  const state = { page: 1, q: '', filters: {}, from: '', to: '' };
  const canWrite = cfg.canWrite !== undefined ? cfg.canWrite : App.can(cfg.module, 'rw');
  const fieldLabels = Object.fromEntries([...(cfg.fields || []), ...(cfg.columns || [])].map((f) => [f.key, f.label]));

  container.innerHTML = `
    <div class="page-head">
      <h2>${esc(cfg.title)} <span class="count muted"></span></h2>
      <div class="page-actions">
        ${(cfg.pageActions || []).map((a, i) => `<button class="btn btn-outline" data-pa="${i}">${esc(a.label)}</button>`).join('')}
        ${canWrite && cfg.fields ? `<button class="btn btn-primary" data-new>+ ${esc(cfg.newLabel || 'Novo')}</button>` : ''}
      </div>
    </div>
    <div class="toolbar">
      ${cfg.searchable !== false ? '<input class="search" placeholder="Pesquisar…">' : ''}
      ${(cfg.filters || []).map((f) => `<select data-filter="${f.key}"><option value="">${esc(f.label)}: todos</option>${optionsFor(f, '')}</select>`).join('')}
      ${cfg.dateFilter ? '<input type="date" data-from title="De"> <input type="date" data-to title="Até">' : ''}
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr>${cfg.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th class="actions-col"></th></tr></thead>
      <tbody></tbody></table></div>
    <div class="pagination"></div>`;

  const tbody = container.querySelector('tbody');
  let rowsCache = [];

  async function load() {
    const params = new URLSearchParams({ page: state.page, limit: 25 });
    if (state.q) params.set('q', state.q);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(cfg.defaultQuery || {})) params.set(k, v);
    let data;
    try {
      data = await API.get(`${cfg.endpoint}?${params}`);
    } catch (err) { toast(err.message, 'err'); return; }
    rowsCache = data.rows;
    container.querySelector('.count').textContent = `(${data.total})`;
    tbody.innerHTML = data.rows.length ? data.rows.map((row) => `
      <tr data-id="${row.id}">
        ${cfg.columns.map((c) => `<td data-th="${esc(c.label)}">${c.fmt ? c.fmt(row[c.key], row) : esc(row[c.key] ?? '—')}</td>`).join('')}
        <td class="row-actions" data-th="Ações">
          ${(cfg.rowActions || []).map((a, i) => !a.show || a.show(row) ? `<button class="icon-btn" data-ra="${i}" title="${esc(a.label)}">${a.icon}</button>` : '').join('')}
          ${cfg.fields ? `<button class="icon-btn" data-edit title="${canWrite ? 'Editar' : 'Visualizar'}">${canWrite ? '✏️' : '👁'}</button>` : ''}
          <button class="icon-btn" data-history title="Histórico">🕘</button>
          ${canWrite && cfg.canDelete !== false ? '<button class="icon-btn" data-del title="Excluir">🗑</button>' : ''}
        </td>
      </tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length + 1}" class="muted empty">Nenhum registro encontrado.</td></tr>`;
    const pag = container.querySelector('.pagination');
    pag.innerHTML = data.pages > 1 ? `
      <button class="btn btn-outline btn-sm" data-pg="-1" ${data.page <= 1 ? 'disabled' : ''}>‹ Anterior</button>
      <span>Página ${data.page} de ${data.pages}</span>
      <button class="btn btn-outline btn-sm" data-pg="1" ${data.page >= data.pages ? 'disabled' : ''}>Próxima ›</button>` : '';
  }

  function openForm(row) {
    const isEdit = !!row;
    const form = formEl(cfg.fields, row || cfg.defaults || {});
    if (!canWrite) form.querySelectorAll('input,select,textarea,button[type=submit]').forEach((i) => { i.disabled = true; });
    const m = modal(isEdit ? `${cfg.itemLabel || cfg.title} #${row.id}` : `Novo — ${cfg.itemLabel || cfg.title}`, form, { wide: cfg.wideForm });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = readForm(form, cfg.fields);
      try {
        if (isEdit) await API.put(`${cfg.endpoint}/${row.id}`, data);
        else await API.post(cfg.endpoint, data);
        toast('Registro salvo');
        m.close();
        load();
        if (cfg.onSaved) cfg.onSaved();
      } catch (err) { toast(err.message, 'err'); }
    };
    if (isEdit && cfg.formExtras) cfg.formExtras(form.parentElement, row);
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const row = tr ? rowsCache.find((r) => String(r.id) === tr.dataset.id) : null;
    try {
      if (btn.hasAttribute('data-new')) openForm(null);
      else if (btn.hasAttribute('data-edit')) openForm(row);
      else if (btn.hasAttribute('data-history')) historyModal(cfg.endpoint, row.id, fieldLabels);
      else if (btn.hasAttribute('data-del')) {
        if (await confirmDialog('Excluir este registro? O histórico será mantido na auditoria.')) {
          await API.del(`${cfg.endpoint}/${row.id}`);
          toast('Registro excluído');
          load();
        }
      } else if (btn.dataset.ra !== undefined) cfg.rowActions[btn.dataset.ra].onClick(row, load);
      else if (btn.dataset.pa !== undefined) cfg.pageActions[btn.dataset.pa].onClick(state);
      else if (btn.dataset.pg) { state.page += Number(btn.dataset.pg); load(); }
    } catch (err) { toast(err.message, 'err'); }
  });

  let debounce;
  const search = container.querySelector('.search');
  if (search) search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = search.value; state.page = 1; load(); }, 350);
  });
  container.querySelectorAll('[data-filter]').forEach((sel) =>
    sel.addEventListener('change', () => { state.filters[sel.dataset.filter] = sel.value; state.page = 1; load(); }));
  const fromI = container.querySelector('[data-from]'), toI = container.querySelector('[data-to]');
  if (fromI) fromI.addEventListener('change', () => { state.from = fromI.value; load(); });
  if (toI) toI.addEventListener('change', () => { state.to = toI.value; load(); });

  load();
  return { reload: load, openForm };
}
