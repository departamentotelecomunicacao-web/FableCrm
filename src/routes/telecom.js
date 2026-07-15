// Rotas de gestão de telefonia: operadoras, planos, linhas, faturas,
// auditoria de análises, contestações e readequação de planos.
const { makeCrud } = require('../crud');

const clientJoin = `
  LEFT JOIN companies c ON c.id = t.company_id
  LEFT JOIN persons p ON p.id = t.person_id`;
const clientName = `, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name`;

const operators = makeCrud({
  table: 'operators', entity: 'operators', module: 'telephony',
  fields: ['name', 'type', 'services', 'notes', 'active'],
  required: ['name'],
  searchFields: ['name'],
  filterFields: ['type', 'active'],
  orderBy: 't.name',
});

const plans = makeCrud({
  table: 'plans', entity: 'plans', module: 'telephony',
  fields: ['operator_id', 'name', 'service_type', 'franchise', 'monthly_value', 'notes', 'active'],
  required: ['name'],
  searchFields: ['name', 'franchise'],
  filterFields: ['operator_id', 'service_type', 'active'],
  joins: 'LEFT JOIN operators o ON o.id = t.operator_id',
  selectExtra: ', o.name AS operator_name',
  orderBy: 't.name',
});

const lines = makeCrud({
  table: 'phone_lines', entity: 'phone_lines', module: 'lines',
  fields: ['company_id', 'person_id', 'number', 'operator_id', 'plan_id', 'franchise',
    'monthly_value', 'responsible', 'cost_center', 'status', 'activation_date', 'notes'],
  required: ['number'],
  searchFields: ['number', 'responsible', 'cost_center'],
  filterFields: ['status', 'operator_id', 'company_id', 'person_id', 'plan_id'],
  joins: `${clientJoin} LEFT JOIN operators o ON o.id = t.operator_id LEFT JOIN plans pl ON pl.id = t.plan_id`,
  selectExtra: `${clientName}, o.name AS operator_name, pl.name AS plan_name`,
  orderBy: 't.number',
});

const invoices = makeCrud({
  table: 'invoices', entity: 'invoices', module: 'invoices',
  fields: ['company_id', 'person_id', 'line_id', 'operator_id', 'invoice_number', 'competence',
    'amount', 'due_date', 'paid_at', 'status', 'notes', 'document_id'],
  searchFields: ['invoice_number', 'competence', 'notes'],
  filterFields: ['status', 'operator_id', 'company_id', 'person_id', 'line_id', 'competence'],
  dateField: 'due_date',
  joins: `${clientJoin} LEFT JOIN operators o ON o.id = t.operator_id LEFT JOIN phone_lines pl ON pl.id = t.line_id`,
  selectExtra: `${clientName}, o.name AS operator_name, pl.number AS line_number`,
  orderBy: 't.due_date DESC NULLS LAST, t.id DESC',
});

const analyses = makeCrud({
  table: 'audit_analyses', entity: 'audit_analyses', module: 'analyses',
  fields: ['company_id', 'person_id', 'invoice_id', 'analyst_id', 'analysis_date',
    'situation', 'description', 'savings_identified', 'recommendations'],
  searchFields: ['situation', 'description', 'recommendations'],
  filterFields: ['analyst_id', 'company_id', 'person_id', 'invoice_id'],
  dateField: 'analysis_date',
  joins: `${clientJoin} LEFT JOIN users u ON u.id = t.analyst_id LEFT JOIN invoices i ON i.id = t.invoice_id`,
  selectExtra: `${clientName}, u.name AS analyst_name, i.invoice_number`,
  orderBy: 't.analysis_date DESC, t.id DESC',
  hooks: {
    beforeSave: async (data, req, before) => {
      if (!before && !data.analyst_id) data.analyst_id = req.user.id;
    },
  },
});

const disputes = makeCrud({
  table: 'disputes', entity: 'disputes', module: 'disputes',
  fields: ['company_id', 'person_id', 'operator_id', 'invoice_id', 'protocol_number',
    'contested_amount', 'dispute_date', 'status', 'result', 'recovered_amount',
    'responsible_id', 'closed_at', 'notes'],
  searchFields: ['protocol_number', 'notes'],
  filterFields: ['status', 'result', 'operator_id', 'company_id', 'responsible_id'],
  dateField: 'dispute_date',
  joins: `${clientJoin} LEFT JOIN operators o ON o.id = t.operator_id LEFT JOIN users u ON u.id = t.responsible_id`,
  selectExtra: `${clientName}, o.name AS operator_name, u.name AS responsible_name`,
  orderBy: 't.dispute_date DESC, t.id DESC',
  withComments: true,
  hooks: {
    beforeSave: async (data, req, before) => {
      if (data.status === 'finalizada' && !data.closed_at && !(before && before.closed_at)) {
        data.closed_at = new Date();
      }
    },
  },
});

const adjustments = makeCrud({
  table: 'plan_adjustments', entity: 'plan_adjustments', module: 'adjustments',
  fields: ['company_id', 'person_id', 'line_id', 'old_plan', 'new_plan', 'old_value',
    'new_value', 'monthly_savings', 'annual_savings', 'adjustment_date',
    'responsible_id', 'status', 'notes'],
  searchFields: ['old_plan', 'new_plan', 'notes'],
  filterFields: ['status', 'company_id', 'responsible_id', 'line_id'],
  dateField: 'adjustment_date',
  joins: `${clientJoin} LEFT JOIN users u ON u.id = t.responsible_id LEFT JOIN phone_lines pl ON pl.id = t.line_id`,
  selectExtra: `${clientName}, u.name AS responsible_name, pl.number AS line_number`,
  orderBy: 't.adjustment_date DESC, t.id DESC',
  hooks: {
    // Calcula economias automaticamente a partir dos valores antigo/novo.
    beforeSave: async (data) => {
      if (data.old_value != null && data.new_value != null && data.monthly_savings == null) {
        data.monthly_savings = (Number(data.old_value) - Number(data.new_value)).toFixed(2);
      }
      if (data.monthly_savings != null && data.annual_savings == null) {
        data.annual_savings = (Number(data.monthly_savings) * 12).toFixed(2);
      }
    },
  },
});

module.exports = { operators, plans, lines, invoices, analyses, disputes, adjustments };
