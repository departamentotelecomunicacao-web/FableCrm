// Rotas do CRM comercial: empresas, contatos, pessoas físicas, leads (kanban),
// agenda (com exportação iCalendar/Google) e tarefas.
const express = require('express');
const { makeCrud } = require('../crud');
const { query } = require('../db');
const { can } = require('../middleware/auth');
const { logAudit } = require('../audit');

const companies = makeCrud({
  table: 'companies', entity: 'companies', module: 'companies',
  fields: ['razao_social', 'nome_fantasia', 'cnpj', 'ie', 'segment_id', 'employees_count',
    'revenue_approx', 'address', 'city', 'state', 'cep', 'site', 'notes', 'is_client', 'status'],
  required: ['razao_social'],
  searchFields: ['razao_social', 'nome_fantasia', 'cnpj', 'city'],
  filterFields: ['status', 'is_client', 'segment_id', 'state'],
  joins: 'LEFT JOIN segments s ON s.id = t.segment_id',
  selectExtra: ', s.name AS segment_name',
  orderBy: 't.razao_social',
});

const contacts = makeCrud({
  table: 'company_contacts', entity: 'company_contacts', module: 'companies',
  fields: ['company_id', 'name', 'role', 'phone', 'whatsapp', 'email', 'is_primary'],
  required: ['company_id', 'name'],
  searchFields: ['name', 'email', 'phone'],
  filterFields: ['company_id'],
  orderBy: 't.is_primary DESC, t.name',
});

const persons = makeCrud({
  table: 'persons', entity: 'persons', module: 'persons',
  fields: ['name', 'cpf', 'birth_date', 'address', 'city', 'state', 'cep',
    'phone', 'whatsapp', 'email', 'notes', 'is_client', 'status'],
  required: ['name'],
  searchFields: ['name', 'cpf', 'email', 'phone'],
  filterFields: ['status', 'is_client', 'state'],
  orderBy: 't.name',
});

const leadJoins = `
  LEFT JOIN companies c ON c.id = t.company_id
  LEFT JOIN persons p ON p.id = t.person_id
  LEFT JOIN users u ON u.id = t.consultant_id
  LEFT JOIN custom_statuses st ON st.id = t.status_id
  LEFT JOIN lead_sources ls ON ls.id = t.source_id`;
const leadExtra = `, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name,
  u.name AS consultant_name, st.name AS status_name, st.color AS status_color,
  st.is_won, st.is_lost, ls.name AS source_name`;

const leads = makeCrud({
  table: 'leads', entity: 'leads', module: 'leads',
  fields: ['title', 'company_id', 'person_id', 'contact_name', 'contact_email', 'contact_phone',
    'source_id', 'consultant_id', 'status_id', 'estimated_value', 'loss_reason_id', 'notes', 'position'],
  required: ['title'],
  searchFields: ['title', 'contact_name', 'contact_email', 'contact_phone', 'notes'],
  filterFields: ['status_id', 'consultant_id', 'source_id', 'company_id', 'person_id'],
  joins: leadJoins, selectExtra: leadExtra,
  orderBy: 't.position, t.id DESC',
  withComments: true,
  hooks: {
    // Marca fechamento quando o lead entra em status ganho/perdido.
    beforeSave: async (data, req, before) => {
      if (data.status_id) {
        const { rows } = await query(
          `SELECT is_won, is_lost FROM custom_statuses WHERE id = $1 AND tenant_id = $2`,
          [data.status_id, req.user.tenantId]);
        if (rows.length) {
          const closed = rows[0].is_won || rows[0].is_lost;
          const wasClosed = before && before.closed_at;
          data.closed_at = closed ? (wasClosed || new Date()) : null;
        }
      }
    },
  },
});

// Movimentação no kanban (arrastar e soltar).
const leadsExtraRoutes = express.Router();
leadsExtraRoutes.patch('/:id/move', can('leads', 'rw'), async (req, res) => {
  const { status_id, position = 0 } = req.body || {};
  if (!status_id) return res.status(400).json({ error: 'status_id é obrigatório' });
  const { rows: beforeRows } = await query(
    `SELECT * FROM leads WHERE tenant_id = $1 AND id = $2`, [req.user.tenantId, req.params.id]);
  if (!beforeRows.length) return res.status(404).json({ error: 'Lead não encontrado' });
  const { rows: stRows } = await query(
    `SELECT is_won, is_lost FROM custom_statuses WHERE id = $1 AND tenant_id = $2`,
    [status_id, req.user.tenantId]);
  if (!stRows.length) return res.status(400).json({ error: 'Status inválido' });
  const closed = stRows[0].is_won || stRows[0].is_lost;
  const { rows } = await query(
    `UPDATE leads SET status_id = $3, position = $4,
       closed_at = CASE WHEN $5 THEN COALESCE(closed_at, now()) ELSE NULL END,
       updated_at = now()
     WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [req.user.tenantId, req.params.id, status_id, position, closed]);
  await logAudit({ req, entity: 'leads', entityId: rows[0].id, action: 'update', before: beforeRows[0], after: rows[0] });
  res.json(rows[0]);
});

const agendaExtra = express.Router();
// Exportação iCalendar — importável no Google Agenda (Configurações > Importar).
agendaExtra.get('/export.ics', can('agenda', 'r'), async (req, res) => {
  const { rows } = await query(
    `SELECT e.*, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name
     FROM agenda_events e
     LEFT JOIN companies c ON c.id = e.company_id
     LEFT JOIN persons p ON p.id = e.person_id
     WHERE e.tenant_id = $1 AND ($2::int IS NULL OR e.user_id = $2)
     ORDER BY e.start_at`, [req.user.tenantId, req.query.mine ? req.user.id : null]);
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FableCRM//Fatura Expert//PT-BR', 'CALSCALE:GREGORIAN'];
  for (const e of rows) {
    lines.push('BEGIN:VEVENT',
      `UID:fablecrm-${e.id}@faturaexpert`,
      `DTSTAMP:${fmt(e.created_at)}`,
      `DTSTART:${fmt(e.start_at)}`,
      `DTEND:${fmt(e.end_at || new Date(new Date(e.start_at).getTime() + 3600000))}`,
      `SUMMARY:${esc(e.title)}${e.client_name ? esc(' - ' + e.client_name) : ''}`,
      `DESCRIPTION:${esc(e.notes)}`,
      `LOCATION:${esc(e.location)}`,
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="agenda-fablecrm.ics"');
  res.send(lines.join('\r\n'));
});

const agenda = makeCrud({
  table: 'agenda_events', entity: 'agenda_events', module: 'agenda',
  fields: ['title', 'type', 'start_at', 'end_at', 'all_day', 'user_id', 'company_id',
    'person_id', 'lead_id', 'location', 'notes', 'done'],
  required: ['title', 'start_at'],
  searchFields: ['title', 'location', 'notes'],
  filterFields: ['type', 'user_id', 'done', 'company_id', 'lead_id'],
  dateField: 'start_at',
  joins: `LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN companies c ON c.id = t.company_id
    LEFT JOIN persons p ON p.id = t.person_id`,
  selectExtra: `, u.name AS user_name, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name`,
  orderBy: 't.start_at',
});

const tasks = makeCrud({
  table: 'tasks', entity: 'tasks', module: 'tasks',
  fields: ['title', 'description', 'assignee_id', 'due_date', 'priority', 'status',
    'company_id', 'person_id', 'lead_id', 'completed_at'],
  required: ['title'],
  searchFields: ['title', 'description'],
  filterFields: ['status', 'priority', 'assignee_id', 'company_id', 'lead_id'],
  dateField: 'due_date',
  joins: `LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN companies c ON c.id = t.company_id
    LEFT JOIN persons p ON p.id = t.person_id`,
  selectExtra: `, u.name AS assignee_name, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client_name`,
  orderBy: `CASE t.status WHEN 'pendente' THEN 0 WHEN 'em_andamento' THEN 1 ELSE 2 END, t.due_date NULLS LAST`,
  withComments: true,
  hooks: {
    beforeSave: async (data, req, before) => {
      if (!before) data.created_by = req.user.id;
      if (data.status === 'concluida' && (!before || before.status !== 'concluida')) {
        data.completed_at = new Date();
      }
    },
  },
});

module.exports = { companies, contacts, persons, leads, leadsExtraRoutes, agenda, agendaExtra, tasks };
