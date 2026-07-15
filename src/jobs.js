// Tarefas agendadas: backup automático do banco e geração de lembretes
// (follow-ups, vencimentos de fatura/receita, contestações paradas,
// contratos a vencer e tarefas atrasadas). Deduplicação via dedup_key.
const cron = require('node-cron');
const { query } = require('./db');
const { runBackup } = require('../scripts/backup');

async function notify({ tenantId, userId = null, type, title, message, entity, entityId, dedupKey }) {
  await query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, message, entity, entity_id, dedup_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING`,
    [tenantId, userId, type, title, message, entity, entityId, dedupKey]);
}

async function generateNotifications() {
  const today = new Date().toISOString().slice(0, 10);

  // Marca faturas e receitas vencidas.
  await query(`UPDATE invoices SET status='atrasada' WHERE status='pendente' AND due_date < CURRENT_DATE`);
  await query(`UPDATE revenues SET status='atrasada' WHERE status='pendente' AND due_date < CURRENT_DATE`);

  // Follow-ups atrasados.
  const followups = await query(
    `SELECT e.id, e.tenant_id, e.user_id, e.title FROM agenda_events e
     WHERE e.type='follow_up' AND NOT e.done AND e.start_at < now()`);
  for (const f of followups.rows) {
    await notify({
      tenantId: f.tenant_id, userId: f.user_id, type: 'follow_up',
      title: 'Follow-up atrasado', message: f.title,
      entity: 'agenda_events', entityId: f.id, dedupKey: `followup-${f.id}-${today}`,
    });
  }

  // Faturas vencendo em até 3 dias.
  const invoices = await query(
    `SELECT id, tenant_id, invoice_number, due_date FROM invoices
     WHERE status IN ('pendente','atrasada') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3`);
  for (const i of invoices.rows) {
    await notify({
      tenantId: i.tenant_id, type: 'vencimento',
      title: 'Fatura próxima do vencimento',
      message: `${i.invoice_number || 'Fatura #' + i.id} vence em ${new Date(i.due_date).toLocaleDateString('pt-BR')}`,
      entity: 'invoices', entityId: i.id, dedupKey: `invoice-due-${i.id}`,
    });
  }

  // Contestações em andamento sem atualização há 7 dias.
  const disputes = await query(
    `SELECT id, tenant_id, responsible_id, protocol_number FROM disputes
     WHERE status IN ('aberta','em_andamento') AND updated_at < now() - interval '7 days'`);
  for (const d of disputes.rows) {
    await notify({
      tenantId: d.tenant_id, userId: d.responsible_id, type: 'contestacao',
      title: 'Contestação sem atualização',
      message: `Protocolo ${d.protocol_number || d.id} está há mais de 7 dias sem movimentação`,
      entity: 'disputes', entityId: d.id, dedupKey: `dispute-stale-${d.id}-${today}`,
    });
  }

  // Contratos vencendo em 30 dias.
  const contracts = await query(
    `SELECT ct.id, ct.tenant_id, ct.end_date, COALESCE(c.nome_fantasia, c.razao_social, p.name) AS client
     FROM contracts ct LEFT JOIN companies c ON c.id=ct.company_id LEFT JOIN persons p ON p.id=ct.person_id
     WHERE ct.status='ativo' AND ct.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`);
  for (const c of contracts.rows) {
    await notify({
      tenantId: c.tenant_id, type: 'contrato',
      title: 'Contrato próximo do vencimento',
      message: `Contrato de ${c.client || '#' + c.id} vence em ${new Date(c.end_date).toLocaleDateString('pt-BR')}`,
      entity: 'contracts', entityId: c.id, dedupKey: `contract-end-${c.id}`,
    });
  }

  // Tarefas vencidas ou vencendo hoje.
  const tasks = await query(
    `SELECT id, tenant_id, assignee_id, title, due_date FROM tasks
     WHERE status IN ('pendente','em_andamento') AND due_date <= CURRENT_DATE`);
  for (const t of tasks.rows) {
    await notify({
      tenantId: t.tenant_id, userId: t.assignee_id, type: 'tarefa',
      title: t.due_date < today ? 'Tarefa atrasada' : 'Tarefa vence hoje',
      message: t.title,
      entity: 'tasks', entityId: t.id, dedupKey: `task-due-${t.id}-${today}`,
    });
  }
}

function startJobs() {
  const backupCron = process.env.BACKUP_CRON || '0 3 * * *';
  const notifyCron = process.env.NOTIFY_CRON || '0 * * * *';

  cron.schedule(backupCron, async () => {
    try {
      const file = await runBackup();
      console.log(`[backup] gerado: ${file}`);
    } catch (err) {
      console.error('[backup] falhou:', err.message);
    }
  });

  cron.schedule(notifyCron, async () => {
    try {
      await generateNotifications();
    } catch (err) {
      console.error('[notificações] falhou:', err.message);
    }
  });

  // Executa uma vez ao subir para popular lembretes.
  generateNotifications().catch((err) => console.error('[notificações] falhou:', err.message));
}

module.exports = { startJobs, generateNotifications };
