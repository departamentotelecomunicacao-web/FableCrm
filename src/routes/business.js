// Contratos e financeiro (receitas e comissões de consultores).
const { makeCrud } = require('../crud');

const clientJoin = `
  LEFT JOIN companies c ON c.id = t.company_id
  LEFT JOIN persons p ON p.id = t.person_id`;
const clientName = `, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name`;

const contracts = makeCrud({
  table: 'contracts', entity: 'contracts', module: 'contracts',
  fields: ['type', 'company_id', 'person_id', 'contract_date', 'start_date', 'end_date',
    'months', 'value', 'renewal_type', 'status', 'document_id', 'notes'],
  searchFields: ['type', 'notes'],
  filterFields: ['status', 'type', 'company_id', 'person_id', 'renewal_type'],
  dateField: 'start_date',
  joins: clientJoin,
  selectExtra: clientName,
  orderBy: 't.end_date DESC NULLS LAST, t.id DESC',
});

const revenues = makeCrud({
  table: 'revenues', entity: 'revenues', module: 'finance',
  fields: ['company_id', 'person_id', 'contract_id', 'description', 'amount',
    'due_date', 'paid_at', 'status', 'notes'],
  required: ['amount'],
  searchFields: ['description', 'notes'],
  filterFields: ['status', 'company_id', 'person_id', 'contract_id'],
  dateField: 'due_date',
  joins: clientJoin,
  selectExtra: clientName,
  orderBy: 't.due_date DESC NULLS LAST, t.id DESC',
  hooks: {
    beforeSave: async (data) => {
      if (data.paid_at && (!data.status || data.status === 'pendente' || data.status === 'atrasada')) {
        data.status = 'paga';
      }
    },
  },
});

const commissions = makeCrud({
  table: 'commissions', entity: 'commissions', module: 'finance',
  fields: ['consultant_id', 'revenue_id', 'reference_month', 'base_amount', 'percent',
    'amount', 'status', 'paid_at', 'notes'],
  required: ['consultant_id'],
  searchFields: ['reference_month', 'notes'],
  filterFields: ['status', 'consultant_id', 'reference_month'],
  joins: 'LEFT JOIN users u ON u.id = t.consultant_id',
  selectExtra: ', u.name AS consultant_name',
  orderBy: 't.reference_month DESC, t.id DESC',
  hooks: {
    // Calcula o valor da comissão a partir de base x percentual.
    beforeSave: async (data) => {
      if (data.base_amount != null && data.percent != null && data.amount == null) {
        data.amount = (Number(data.base_amount) * Number(data.percent) / 100).toFixed(2);
      }
      if (data.paid_at && data.status !== 'paga') data.status = 'paga';
    },
  },
});

module.exports = { contracts, revenues, commissions };
