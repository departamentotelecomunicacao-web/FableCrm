// CRM comercial: empresas, pessoas físicas, leads (kanban), agenda e tarefas.

const UF_LIST = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function contactsModal(company) {
  const canWrite = App.can('companies', 'rw');
  const body = el('<div><div class="contacts-list muted">Carregando…</div><div class="contacts-form"></div></div>');
  const fields = [
    { key: 'name', label: 'Nome', required: true },
    { key: 'role', label: 'Cargo' },
    { key: 'phone', label: 'Telefone' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'email', label: 'E-mail' },
    { key: 'is_primary', label: 'Contato principal', type: 'checkbox' },
  ];
  const list = body.querySelector('.contacts-list');
  const formSlot = body.querySelector('.contacts-form');

  const openForm = (row) => {
    formSlot.innerHTML = '<h4>' + (row ? 'Editar responsável' : 'Novo responsável') + '</h4>';
    const form = formEl(fields, row || {});
    form.querySelector('[data-close]').onclick = () => { formSlot.innerHTML = ''; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = { ...readForm(form, fields), company_id: company.id };
      try {
        if (row) await API.put(`/contacts/${row.id}`, data);
        else await API.post('/contacts', data);
        formSlot.innerHTML = '';
        toast('Responsável salvo');
        load();
      } catch (err) { toast(err.message, 'err'); }
    };
    formSlot.appendChild(form);
  };

  let rows = [];
  const load = async () => {
    rows = (await API.get(`/contacts?company_id=${company.id}&limit=100`)).rows;
    list.classList.remove('muted');
    list.innerHTML = rows.length ? rows.map((c) => `
      <div class="doc-row" data-id="${c.id}">
        <b>${esc(c.name)}</b> ${c.is_primary ? badge('Principal', '#008300') : ''}
        <span class="muted">${esc(c.role || '')}</span>
        <span class="muted">${esc(c.phone || '')} ${c.whatsapp ? '• WhatsApp: ' + esc(c.whatsapp) : ''} ${c.email ? '• ' + esc(c.email) : ''}</span>
        ${canWrite ? '<button class="icon-btn" data-e title="Editar">✏️</button><button class="icon-btn" data-x title="Excluir">🗑</button>' : ''}
      </div>`).join('') : '<p class="muted">Nenhum responsável cadastrado.</p>';
  };
  list.addEventListener('click', async (e) => {
    const row = rows.find((r) => String(r.id) === e.target.closest('[data-id]')?.dataset.id);
    if (!row) return;
    if (e.target.closest('[data-e]')) openForm(row);
    if (e.target.closest('[data-x]') && await confirmDialog('Excluir este responsável?')) {
      try { await API.del(`/contacts/${row.id}`); load(); } catch (err) { toast(err.message, 'err'); }
    }
  });
  if (canWrite) {
    const add = el('<button class="btn btn-outline btn-sm" style="margin-top:8px">+ Adicionar responsável</button>');
    add.onclick = () => openForm(null);
    body.appendChild(add);
  }
  load().catch(() => { list.textContent = 'Erro ao carregar.'; });
  modal(`Responsáveis — ${company.nome_fantasia || company.razao_social}`, body, { wide: true });
}

Views.companies = (container) => {
  resourceView(container, {
    title: 'Empresas', module: 'companies', endpoint: '/companies', itemLabel: 'Empresa', wideForm: true,
    columns: [
      { key: 'razao_social', label: 'Razão Social', fmt: (v, r) => `<b>${esc(v)}</b>${r.nome_fantasia ? `<br><span class="muted">${esc(r.nome_fantasia)}</span>` : ''}` },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'segment_name', label: 'Segmento' },
      { key: 'city', label: 'Cidade', fmt: (v, r) => esc([v, r.state].filter(Boolean).join(' / ') || '—') },
      { key: 'is_client', label: 'Cliente', fmt: (v) => v ? badge('Cliente', '#008300') : badge('Prospect', '#2a78d6') },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['ativo', 'inativo', 'prospect'] },
      { key: 'segment_id', label: 'Segmento', options: 'segments' },
    ],
    fields: [
      { key: 'razao_social', label: 'Razão Social', required: true },
      { key: 'nome_fantasia', label: 'Nome Fantasia' },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'ie', label: 'Inscrição Estadual' },
      { key: 'segment_id', label: 'Segmento', type: 'select', options: 'segments' },
      { key: 'employees_count', label: 'Qtde. de funcionários', type: 'number', step: 1 },
      { key: 'revenue_approx', label: 'Faturamento aproximado (R$)', type: 'money' },
      { key: 'site', label: 'Site' },
      { key: 'address', label: 'Endereço', full: true },
      { key: 'city', label: 'Cidade' },
      { key: 'state', label: 'Estado', type: 'select', options: UF_LIST.map((u) => ({ value: u, label: u })) },
      { key: 'cep', label: 'CEP' },
      { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo', 'prospect'], default: 'ativo' },
      { key: 'is_client', label: 'É cliente', type: 'checkbox' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      { icon: '👥', label: 'Responsáveis', onClick: (row) => contactsModal(row) },
      { icon: '📎', label: 'Documentos', onClick: (row) => docsModal('companies', row.id, `Documentos — ${row.nome_fantasia || row.razao_social}`) },
    ],
  });
};

Views.persons = (container) => {
  resourceView(container, {
    title: 'Pessoas Físicas', module: 'persons', endpoint: '/persons', itemLabel: 'Pessoa', wideForm: true,
    columns: [
      { key: 'name', label: 'Nome', fmt: (v) => `<b>${esc(v)}</b>` },
      { key: 'cpf', label: 'CPF' },
      { key: 'phone', label: 'Telefone', fmt: (v, r) => esc(v || r.whatsapp || '—') },
      { key: 'email', label: 'E-mail' },
      { key: 'city', label: 'Cidade', fmt: (v, r) => esc([v, r.state].filter(Boolean).join(' / ') || '—') },
      { key: 'is_client', label: 'Cliente', fmt: (v) => v ? badge('Cliente', '#008300') : badge('Prospect', '#2a78d6') },
    ],
    filters: [{ key: 'status', label: 'Status', options: ['ativo', 'inativo', 'prospect'] }],
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'cpf', label: 'CPF' },
      { key: 'birth_date', label: 'Data de nascimento', type: 'date' },
      { key: 'phone', label: 'Telefone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'email', label: 'E-mail' },
      { key: 'address', label: 'Endereço', full: true },
      { key: 'city', label: 'Cidade' },
      { key: 'state', label: 'Estado', type: 'select', options: UF_LIST.map((u) => ({ value: u, label: u })) },
      { key: 'cep', label: 'CEP' },
      { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo', 'prospect'], default: 'ativo' },
      { key: 'is_client', label: 'É cliente', type: 'checkbox' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      { icon: '📎', label: 'Documentos', onClick: (row) => docsModal('persons', row.id, `Documentos — ${row.name}`) },
    ],
  });
};

// ------------------- Leads (Kanban) -------------------

const LEAD_FIELDS = [
  { key: 'title', label: 'Título do lead', required: true, full: true },
  { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
  { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
  { key: 'contact_name', label: 'Nome do contato' },
  { key: 'contact_email', label: 'E-mail do contato' },
  { key: 'contact_phone', label: 'Telefone do contato' },
  { key: 'source_id', label: 'Origem', type: 'select', options: 'sources' },
  { key: 'consultant_id', label: 'Consultor', type: 'select', options: 'users' },
  { key: 'status_id', label: 'Status', type: 'select', options: 'statuses' },
  { key: 'estimated_value', label: 'Valor estimado (R$)', type: 'money' },
  { key: 'loss_reason_id', label: 'Motivo de perda', type: 'select', options: 'lossReasons' },
  { key: 'notes', label: 'Observações', type: 'textarea', full: true },
];

function leadModal(row, onSaved) {
  const canWrite = App.can('leads', 'rw');
  const isEdit = !!row;
  const wrap = el('<div></div>');
  const form = formEl(LEAD_FIELDS, row || { consultant_id: App.user.id, status_id: (App.meta.statuses.find((s) => s.context === 'lead') || {}).id });
  if (!canWrite) form.querySelectorAll('input,select,textarea,button[type=submit]').forEach((i) => { i.disabled = true; });
  wrap.appendChild(form);
  if (isEdit) {
    const extras = el(`<div class="lead-extras">
      <div class="lead-extras-head"><h4>Comentários e histórico</h4>
      <button class="btn btn-outline btn-sm" data-h>🕘 Histórico completo</button></div></div>`);
    extras.querySelector('[data-h]').onclick = () =>
      historyModal('/leads', row.id, Object.fromEntries(LEAD_FIELDS.map((f) => [f.key, f.label])));
    extras.appendChild(commentsBox('/leads', row.id));
    wrap.appendChild(extras);
  }
  const m = modal(isEdit ? `Lead #${row.id} — ${row.title}` : 'Novo lead', wrap, { wide: true });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = readForm(form, LEAD_FIELDS);
    try {
      if (isEdit) await API.put(`/leads/${row.id}`, data);
      else await API.post('/leads', data);
      toast('Lead salvo');
      m.close();
      onSaved();
    } catch (err) { toast(err.message, 'err'); }
  };
}

Views.leads = async (container) => {
  const canWrite = App.can('leads', 'rw');
  const statuses = App.meta.statuses.filter((s) => s.context === 'lead');
  container.innerHTML = `
    <div class="page-head">
      <h2>Leads <span class="count muted"></span></h2>
      <div class="page-actions">
        <select class="lead-consultant"><option value="">Consultor: todos</option>
          ${App.meta.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
        <input class="search" placeholder="Pesquisar leads…">
        ${canWrite ? '<button class="btn btn-primary" data-new>+ Novo lead</button>' : ''}
      </div>
    </div>
    <div class="kanban"></div>`;

  const board = container.querySelector('.kanban');
  const state = { q: '', consultant: '' };

  async function load() {
    const params = new URLSearchParams({ limit: 500 });
    if (state.q) params.set('q', state.q);
    if (state.consultant) params.set('consultant_id', state.consultant);
    let data;
    try { data = await API.get(`/leads?${params}`); } catch (err) { toast(err.message, 'err'); return; }
    container.querySelector('.count').textContent = `(${data.total})`;
    const byStatus = {};
    for (const l of data.rows) (byStatus[l.status_id] = byStatus[l.status_id] || []).push(l);

    board.innerHTML = statuses.map((s) => {
      const cards = byStatus[s.id] || [];
      const total = cards.reduce((sum, c) => sum + Number(c.estimated_value || 0), 0);
      return `<div class="kanban-col" data-status="${s.id}">
        <div class="kanban-col-head" style="--sc:${s.color}">
          <span>${esc(s.name)}</span><span class="muted">${cards.length} · ${fmtMoney(total)}</span>
        </div>
        <div class="kanban-cards">
          ${cards.map((c) => `
            <div class="kanban-card" draggable="${canWrite}" data-id="${c.id}">
              <b>${esc(c.title)}</b>
              ${c.client_name ? `<span class="muted">${esc(c.client_name)}</span>` : ''}
              <div class="kanban-card-foot">
                <span>${c.estimated_value ? fmtMoney(c.estimated_value) : ''}</span>
                <span class="muted" title="Consultor">${esc((c.consultant_name || '').split(' ')[0])}</span>
              </div>
            </div>`).join('')}
        </div></div>`;
    }).join('');

    board.querySelectorAll('.kanban-card').forEach((card) => {
      card.addEventListener('click', () => {
        const lead = data.rows.find((r) => String(r.id) === card.dataset.id);
        leadModal(lead, load);
      });
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    board.querySelectorAll('.kanban-col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop-target'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drop-target');
        const id = e.dataTransfer.getData('text/plain');
        const statusId = col.dataset.status;
        try {
          await API.patch(`/leads/${id}/move`, { status_id: Number(statusId), position: col.querySelectorAll('.kanban-card').length });
          load();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  let debounce;
  container.querySelector('.search').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = e.target.value; load(); }, 350);
  });
  container.querySelector('.lead-consultant').addEventListener('change', (e) => { state.consultant = e.target.value; load(); });
  const newBtn = container.querySelector('[data-new]');
  if (newBtn) newBtn.onclick = () => leadModal(null, load);
  load();
};

// ------------------- Agenda -------------------

function googleCalendarUrl(ev) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = ev.end_at || new Date(new Date(ev.start_at).getTime() + 3600000);
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title,
    dates: `${fmt(ev.start_at)}/${fmt(end)}`,
    details: ev.notes || 'Compromisso FableCRM - Fatura Expert',
    location: ev.location || '',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

Views.agenda = (container) => {
  resourceView(container, {
    title: 'Agenda', module: 'agenda', endpoint: '/agenda', itemLabel: 'Compromisso', newLabel: 'Compromisso',
    dateFilter: true,
    columns: [
      { key: 'start_at', label: 'Quando', fmt: (v, r) => `<b>${fmtDateTime(v)}</b>${r.end_at ? `<br><span class="muted">até ${fmtDateTime(r.end_at)}</span>` : ''}` },
      { key: 'type', label: 'Tipo', fmt: (v) => badge(label(v), '#4a3aa7') },
      { key: 'title', label: 'Título', fmt: (v, r) => `${esc(v)}${r.location ? `<br><span class="muted">📍 ${esc(r.location)}</span>` : ''}` },
      { key: 'client_name', label: 'Cliente' },
      { key: 'user_name', label: 'Responsável' },
      { key: 'done', label: 'Situação', fmt: (v, r) => v ? badge('Concluído', '#008300') : (new Date(r.start_at) < new Date() ? badge('Atrasado', '#e34948') : badge('Agendado', '#2a78d6')) },
    ],
    filters: [
      { key: 'type', label: 'Tipo', options: ['reuniao', 'ligacao', 'retorno', 'follow_up', 'compromisso'] },
      { key: 'user_id', label: 'Responsável', options: 'users' },
    ],
    fields: [
      { key: 'title', label: 'Título', required: true, full: true },
      { key: 'type', label: 'Tipo', type: 'select', options: ['reuniao', 'ligacao', 'retorno', 'follow_up', 'compromisso'], required: true, default: 'reuniao' },
      { key: 'user_id', label: 'Responsável', type: 'select', options: 'users' },
      { key: 'start_at', label: 'Início', type: 'datetime', required: true },
      { key: 'end_at', label: 'Fim', type: 'datetime' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'location', label: 'Local' },
      { key: 'done', label: 'Concluído', type: 'checkbox' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    pageActions: [
      {
        label: '⬇ Exportar (.ics)',
        onClick: () => API.download('/agenda/export.ics', 'agenda-fablecrm.ics')
          .then(() => toast('Agenda exportada — importe no Google Agenda'))
          .catch((e) => toast(e.message, 'err')),
      },
    ],
    rowActions: [
      { icon: '📅', label: 'Adicionar ao Google Agenda', onClick: (row) => window.open(googleCalendarUrl(row), '_blank') },
      {
        icon: '✔', label: 'Marcar como concluído', show: (r) => !r.done && App.can('agenda', 'rw'),
        onClick: async (row, reload) => { await API.put(`/agenda/${row.id}`, { done: true }); toast('Concluído'); reload(); },
      },
    ],
  });
};

// ------------------- Tarefas -------------------

Views.tasks = (container) => {
  resourceView(container, {
    title: 'Tarefas', module: 'tasks', endpoint: '/tasks', itemLabel: 'Tarefa', newLabel: 'Tarefa',
    dateFilter: true,
    columns: [
      { key: 'title', label: 'Tarefa', fmt: (v, r) => `<b>${esc(v)}</b>${r.client_name ? `<br><span class="muted">${esc(r.client_name)}</span>` : ''}` },
      { key: 'assignee_name', label: 'Responsável' },
      { key: 'due_date', label: 'Prazo', fmt: (v, r) => v ? (new Date(v) < new Date() && ['pendente', 'em_andamento'].includes(r.status) ? `<span class="overdue">${fmtDate(v)}</span>` : fmtDate(v)) : '—' },
      { key: 'priority', label: 'Prioridade', fmt: statusBadge },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['pendente', 'em_andamento', 'concluida', 'cancelada'] },
      { key: 'priority', label: 'Prioridade', options: ['baixa', 'media', 'alta'] },
      { key: 'assignee_id', label: 'Responsável', options: 'users' },
    ],
    fields: [
      { key: 'title', label: 'Título', required: true, full: true },
      { key: 'assignee_id', label: 'Responsável', type: 'select', options: 'users' },
      { key: 'due_date', label: 'Prazo', type: 'date' },
      { key: 'priority', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta'], default: 'media' },
      { key: 'status', label: 'Status', type: 'select', options: ['pendente', 'em_andamento', 'concluida', 'cancelada'], default: 'pendente' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'description', label: 'Descrição', type: 'textarea', full: true },
    ],
    rowActions: [
      {
        icon: '✔', label: 'Concluir', show: (r) => ['pendente', 'em_andamento'].includes(r.status) && App.can('tasks', 'rw'),
        onClick: async (row, reload) => { await API.put(`/tasks/${row.id}`, { status: 'concluida' }); toast('Tarefa concluída'); reload(); },
      },
      { icon: '💬', label: 'Comentários', onClick: (row) => modal(`Comentários — ${row.title}`, commentsBox('/tasks', row.id)) },
    ],
  });
};
