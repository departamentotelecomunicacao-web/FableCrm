// Gestão de telefonia: operadoras, planos, linhas, faturas, auditoria,
// contestações e readequação de planos.

const SERVICES = ['movel', 'fixa', 'fibra', 'tv', 'link_dedicado', 'm2m_iot'];

Views.telephony = (container) => {
  container.innerHTML = `
    <div class="tabs"><button class="tab active" data-t="ops">Operadoras</button>
    <button class="tab" data-t="plans">Planos</button></div>
    <div class="tab-body"></div>`;
  const body = container.querySelector('.tab-body');

  const renderOps = () => resourceView(body, {
    title: 'Operadoras', module: 'telephony', endpoint: '/operators', itemLabel: 'Operadora',
    columns: [
      { key: 'name', label: 'Operadora', fmt: (v) => `<b>${esc(v)}</b>` },
      { key: 'type', label: 'Tipo' },
      { key: 'services', label: 'Serviços', fmt: (v) => (v || []).map((s) => badge(label(s), '#0ea5e9')).join(' ') || '—' },
      { key: 'active', label: 'Situação', fmt: (v) => v ? badge('Ativa', '#008300') : badge('Inativa', '#94a3b8') },
    ],
    filters: [{ key: 'type', label: 'Tipo', options: ['Vivo', 'Claro', 'TIM', 'Oi', 'Outras'].map((v) => ({ value: v, label: v })) }],
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'type', label: 'Tipo', type: 'select', options: ['Vivo', 'Claro', 'TIM', 'Oi', 'Outras'].map((v) => ({ value: v, label: v })), required: true, default: 'Outras' },
      { key: 'services', label: 'Serviços oferecidos', type: 'checkboxes', options: SERVICES },
      { key: 'active', label: 'Ativa', type: 'checkbox', default: true },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
  });

  const renderPlans = () => resourceView(body, {
    title: 'Planos', module: 'telephony', endpoint: '/plans', itemLabel: 'Plano',
    columns: [
      { key: 'name', label: 'Plano', fmt: (v) => `<b>${esc(v)}</b>` },
      { key: 'operator_name', label: 'Operadora' },
      { key: 'service_type', label: 'Serviço', fmt: (v) => badge(label(v), '#0ea5e9') },
      { key: 'franchise', label: 'Franquia' },
      { key: 'monthly_value', label: 'Valor mensal', fmt: fmtMoney },
      { key: 'active', label: 'Situação', fmt: (v) => v ? badge('Ativo', '#008300') : badge('Inativo', '#94a3b8') },
    ],
    filters: [
      { key: 'operator_id', label: 'Operadora', options: 'operators' },
      { key: 'service_type', label: 'Serviço', options: SERVICES },
    ],
    fields: [
      { key: 'name', label: 'Nome do plano', required: true },
      { key: 'operator_id', label: 'Operadora', type: 'select', options: 'operators' },
      { key: 'service_type', label: 'Tipo de serviço', type: 'select', options: SERVICES, required: true, default: 'movel' },
      { key: 'franchise', label: 'Franquia' },
      { key: 'monthly_value', label: 'Valor mensal (R$)', type: 'money' },
      { key: 'active', label: 'Ativo', type: 'checkbox', default: true },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
  });

  container.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => {
    container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    tab.dataset.t === 'ops' ? renderOps() : renderPlans();
  });
  renderOps();
};

Views.lines = (container) => {
  resourceView(container, {
    title: 'Linhas', module: 'lines', endpoint: '/lines', itemLabel: 'Linha', newLabel: 'Linha',
    columns: [
      { key: 'number', label: 'Número', fmt: (v) => `<b>${esc(v)}</b>` },
      { key: 'client_name', label: 'Cliente' },
      { key: 'operator_name', label: 'Operadora' },
      { key: 'plan_name', label: 'Plano', fmt: (v, r) => esc(v || r.franchise || '—') },
      { key: 'monthly_value', label: 'Valor', fmt: fmtMoney },
      { key: 'cost_center', label: 'Centro de custo' },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['ativa', 'suspensa', 'cancelada', 'portada'] },
      { key: 'operator_id', label: 'Operadora', options: 'operators' },
      { key: 'company_id', label: 'Empresa', options: 'companies' },
    ],
    fields: [
      { key: 'number', label: 'Número', required: true },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'operator_id', label: 'Operadora', type: 'select', options: 'operators' },
      { key: 'plan_id', label: 'Plano', type: 'select', options: 'plans' },
      { key: 'franchise', label: 'Franquia' },
      { key: 'monthly_value', label: 'Valor mensal (R$)', type: 'money' },
      { key: 'responsible', label: 'Responsável pela linha' },
      { key: 'cost_center', label: 'Centro de custo' },
      { key: 'status', label: 'Status', type: 'select', options: ['ativa', 'suspensa', 'cancelada', 'portada'], default: 'ativa' },
      { key: 'activation_date', label: 'Data de ativação', type: 'date' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
  });
};

Views.invoices = (container) => {
  resourceView(container, {
    title: 'Faturas', module: 'invoices', endpoint: '/invoices', itemLabel: 'Fatura', newLabel: 'Fatura',
    dateFilter: true,
    columns: [
      { key: 'invoice_number', label: 'Fatura', fmt: (v, r) => `<b>${esc(v || '#' + r.id)}</b>${r.line_number ? `<br><span class="muted">${esc(r.line_number)}</span>` : ''}` },
      { key: 'client_name', label: 'Cliente' },
      { key: 'operator_name', label: 'Operadora' },
      { key: 'competence', label: 'Competência' },
      { key: 'amount', label: 'Valor', fmt: fmtMoney },
      { key: 'due_date', label: 'Vencimento', fmt: fmtDate },
      { key: 'paid_at', label: 'Pagamento', fmt: fmtDate },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['pendente', 'paga', 'atrasada', 'contestada', 'cancelada'] },
      { key: 'operator_id', label: 'Operadora', options: 'operators' },
      { key: 'company_id', label: 'Empresa', options: 'companies' },
    ],
    fields: [
      { key: 'invoice_number', label: 'Número da fatura' },
      { key: 'competence', label: 'Competência', type: 'month' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'operator_id', label: 'Operadora', type: 'select', options: 'operators' },
      { key: 'amount', label: 'Valor (R$)', type: 'money' },
      { key: 'due_date', label: 'Vencimento', type: 'date' },
      { key: 'paid_at', label: 'Pagamento', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['pendente', 'paga', 'atrasada', 'contestada', 'cancelada'], default: 'pendente' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      { icon: '📎', label: 'PDF / anexos da fatura', onClick: (row) => docsModal('invoices', row.id, `Anexos — Fatura ${row.invoice_number || '#' + row.id}`) },
    ],
  });
};

Views.analyses = (container) => {
  resourceView(container, {
    title: 'Auditoria de Faturas', module: 'analyses', endpoint: '/analyses', itemLabel: 'Análise', newLabel: 'Análise',
    dateFilter: true, wideForm: true,
    columns: [
      { key: 'analysis_date', label: 'Data', fmt: fmtDate },
      { key: 'client_name', label: 'Cliente' },
      { key: 'analyst_name', label: 'Analista' },
      { key: 'situation', label: 'Situação encontrada' },
      { key: 'savings_identified', label: 'Economia identificada', fmt: fmtMoney },
    ],
    filters: [{ key: 'analyst_id', label: 'Analista', options: 'users' }],
    fields: [
      { key: 'analysis_date', label: 'Data da análise', type: 'date', required: true },
      { key: 'analyst_id', label: 'Analista', type: 'select', options: 'users' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'situation', label: 'Situação encontrada', full: true },
      { key: 'description', label: 'Descrição', type: 'textarea', full: true },
      { key: 'savings_identified', label: 'Economia identificada (R$)', type: 'money' },
      { key: 'recommendations', label: 'Recomendações', type: 'textarea', full: true },
    ],
  });
};

Views.disputes = (container) => {
  resourceView(container, {
    title: 'Contestações', module: 'disputes', endpoint: '/disputes', itemLabel: 'Contestação', newLabel: 'Contestação',
    dateFilter: true,
    columns: [
      { key: 'protocol_number', label: 'Protocolo', fmt: (v, r) => `<b>${esc(v || '#' + r.id)}</b>` },
      { key: 'client_name', label: 'Cliente' },
      { key: 'operator_name', label: 'Operadora' },
      { key: 'dispute_date', label: 'Data', fmt: fmtDate },
      { key: 'contested_amount', label: 'Contestado', fmt: fmtMoney },
      { key: 'status', label: 'Status', fmt: statusBadge },
      { key: 'result', label: 'Resultado', fmt: (v) => v ? statusBadge(v) : '—' },
      { key: 'recovered_amount', label: 'Recuperado', fmt: fmtMoney },
      { key: 'responsible_name', label: 'Responsável' },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['aberta', 'em_andamento', 'finalizada'] },
      { key: 'result', label: 'Resultado', options: ['aprovada', 'negada', 'parcial'] },
      { key: 'operator_id', label: 'Operadora', options: 'operators' },
    ],
    fields: [
      { key: 'operator_id', label: 'Operadora', type: 'select', options: 'operators', required: true },
      { key: 'protocol_number', label: 'Número do protocolo' },
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'contested_amount', label: 'Valor contestado (R$)', type: 'money' },
      { key: 'dispute_date', label: 'Data', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['aberta', 'em_andamento', 'finalizada'], default: 'em_andamento' },
      { key: 'responsible_id', label: 'Responsável', type: 'select', options: 'users' },
      { key: 'result', label: 'Resultado', type: 'select', options: ['aprovada', 'negada', 'parcial'] },
      { key: 'recovered_amount', label: 'Valor recuperado (R$)', type: 'money' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
    rowActions: [
      { icon: '💬', label: 'Comentários', onClick: (row) => modal(`Comentários — ${row.protocol_number || '#' + row.id}`, commentsBox('/disputes', row.id)) },
      { icon: '📎', label: 'Documentos', onClick: (row) => docsModal('disputes', row.id, `Documentos — ${row.protocol_number || '#' + row.id}`) },
    ],
  });
};

Views.adjustments = (container) => {
  resourceView(container, {
    title: 'Readequação de Planos', module: 'adjustments', endpoint: '/adjustments', itemLabel: 'Readequação', newLabel: 'Readequação',
    dateFilter: true,
    columns: [
      { key: 'adjustment_date', label: 'Data', fmt: fmtDate },
      { key: 'client_name', label: 'Cliente', fmt: (v, r) => `${esc(v || '—')}${r.line_number ? `<br><span class="muted">${esc(r.line_number)}</span>` : ''}` },
      { key: 'old_plan', label: 'Plano antigo', fmt: (v, r) => `${esc(v || '—')}<br><span class="muted">${fmtMoney(r.old_value)}</span>` },
      { key: 'new_plan', label: 'Plano novo', fmt: (v, r) => `${esc(v || '—')}<br><span class="muted">${fmtMoney(r.new_value)}</span>` },
      { key: 'monthly_savings', label: 'Economia mensal', fmt: (v) => `<b>${fmtMoney(v)}</b>` },
      { key: 'annual_savings', label: 'Economia anual', fmt: fmtMoney },
      { key: 'responsible_name', label: 'Responsável' },
      { key: 'status', label: 'Status', fmt: statusBadge },
    ],
    filters: [{ key: 'status', label: 'Status', options: ['proposta', 'aprovada', 'implantada', 'cancelada'] }],
    fields: [
      { key: 'company_id', label: 'Empresa', type: 'select', options: 'companies' },
      { key: 'person_id', label: 'Pessoa física', type: 'select', options: 'persons' },
      { key: 'old_plan', label: 'Plano antigo' },
      { key: 'old_value', label: 'Valor antigo (R$)', type: 'money' },
      { key: 'new_plan', label: 'Plano novo' },
      { key: 'new_value', label: 'Valor novo (R$)', type: 'money' },
      { key: 'monthly_savings', label: 'Economia mensal (R$)', type: 'money' },
      { key: 'annual_savings', label: 'Economia anual (R$)', type: 'money' },
      { key: 'adjustment_date', label: 'Data', type: 'date' },
      { key: 'responsible_id', label: 'Responsável', type: 'select', options: 'users' },
      { key: 'status', label: 'Status', type: 'select', options: ['proposta', 'aprovada', 'implantada', 'cancelada'], default: 'proposta' },
      { key: 'notes', label: 'Observações', type: 'textarea', full: true },
    ],
  });
};
