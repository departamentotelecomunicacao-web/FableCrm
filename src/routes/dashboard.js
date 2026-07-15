const express = require('express');
const { query } = require('../db');
const { can } = require('../middleware/auth');

const router = express.Router();

router.get('/', can('dashboard', 'r'), async (req, res) => {
  const t = [req.user.tenantId];
  const one = async (sql) => (await query(sql, t)).rows[0];
  const all = async (sql) => (await query(sql, t)).rows;

  const [clients, leadsNew, proposals, closedMonth, dispOpen, dispDone, savings,
    revenueMonth, revenueForecast, tasksPending, followupsLate, agendaToday] = await Promise.all([
    one(`SELECT (SELECT count(*) FROM companies WHERE tenant_id=$1 AND is_client AND status='ativo')
              + (SELECT count(*) FROM persons WHERE tenant_id=$1 AND is_client AND status='ativo') AS n`),
    one(`SELECT count(*)::int AS n FROM leads WHERE tenant_id=$1 AND created_at >= date_trunc('month', now())`),
    one(`SELECT count(*)::int AS n, COALESCE(sum(estimated_value),0) AS value FROM leads l
         JOIN custom_statuses s ON s.id=l.status_id
         WHERE l.tenant_id=$1 AND s.name IN ('Proposta','Negociação')`),
    one(`SELECT count(*)::int AS n, COALESCE(sum(estimated_value),0) AS value FROM leads l
         JOIN custom_statuses s ON s.id=l.status_id
         WHERE l.tenant_id=$1 AND s.is_won AND l.closed_at >= date_trunc('month', now())`),
    one(`SELECT count(*)::int AS n, COALESCE(sum(contested_amount),0) AS value FROM disputes
         WHERE tenant_id=$1 AND status IN ('aberta','em_andamento')`),
    one(`SELECT count(*)::int AS n, COALESCE(sum(recovered_amount),0) AS value FROM disputes
         WHERE tenant_id=$1 AND status='finalizada'`),
    one(`SELECT COALESCE((SELECT sum(recovered_amount) FROM disputes WHERE tenant_id=$1 AND status='finalizada'),0)
              + COALESCE((SELECT sum(savings_identified) FROM audit_analyses WHERE tenant_id=$1),0)
              + COALESCE((SELECT sum(annual_savings) FROM plan_adjustments WHERE tenant_id=$1 AND status='implantada'),0) AS value`),
    one(`SELECT COALESCE(sum(amount),0) AS value FROM revenues
         WHERE tenant_id=$1 AND status='paga' AND paid_at >= date_trunc('month', now())`),
    one(`SELECT COALESCE(sum(amount),0) AS value FROM revenues
         WHERE tenant_id=$1 AND status IN ('pendente','atrasada')`),
    one(`SELECT count(*)::int AS n FROM tasks WHERE tenant_id=$1 AND status IN ('pendente','em_andamento')`),
    one(`SELECT count(*)::int AS n FROM agenda_events
         WHERE tenant_id=$1 AND type='follow_up' AND NOT done AND start_at < now()`),
    all(`SELECT e.id, e.title, e.type, e.start_at, e.location, u.name AS user_name
         FROM agenda_events e LEFT JOIN users u ON u.id=e.user_id
         WHERE e.tenant_id=$1 AND e.start_at::date = CURRENT_DATE ORDER BY e.start_at`),
  ]);

  const [salesByMonth, savingsByMonth, funnel, consultants] = await Promise.all([
    all(`SELECT to_char(closed_at,'YYYY-MM') AS month, count(*)::int AS n, COALESCE(sum(estimated_value),0) AS value
         FROM leads l JOIN custom_statuses s ON s.id=l.status_id
         WHERE l.tenant_id=$1 AND s.is_won AND closed_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1`),
    all(`SELECT month, sum(value) AS value FROM (
           SELECT to_char(closed_at,'YYYY-MM') AS month, sum(recovered_amount) AS value FROM disputes
             WHERE tenant_id=$1 AND status='finalizada' AND closed_at >= now() - interval '12 months' GROUP BY 1
           UNION ALL
           SELECT to_char(analysis_date,'YYYY-MM'), sum(savings_identified) FROM audit_analyses
             WHERE tenant_id=$1 AND analysis_date >= now() - interval '12 months' GROUP BY 1
         ) x WHERE month IS NOT NULL GROUP BY 1 ORDER BY 1`),
    all(`SELECT s.name, s.color, count(l.id)::int AS n, COALESCE(sum(l.estimated_value),0) AS value
         FROM custom_statuses s LEFT JOIN leads l ON l.status_id=s.id AND l.tenant_id=$1
         WHERE s.tenant_id=$1 AND s.context='lead' GROUP BY s.id ORDER BY s.sort_order`),
    all(`SELECT u.name, count(l.id) FILTER (WHERE s.is_won)::int AS won,
                count(l.id)::int AS total,
                COALESCE(sum(l.estimated_value) FILTER (WHERE s.is_won),0) AS value
         FROM users u LEFT JOIN leads l ON l.consultant_id=u.id AND l.tenant_id=$1
         LEFT JOIN custom_statuses s ON s.id=l.status_id
         WHERE u.tenant_id=$1 AND u.role IN ('comercial','gestor','admin')
         GROUP BY u.id HAVING count(l.id) > 0 ORDER BY value DESC`),
  ]);

  res.json({
    indicators: {
      activeClients: Number(clients.n),
      newLeads: leadsNew.n,
      proposals: { count: proposals.n, value: Number(proposals.value) },
      closedMonth: { count: closedMonth.n, value: Number(closedMonth.value) },
      disputesOpen: { count: dispOpen.n, value: Number(dispOpen.value) },
      disputesDone: { count: dispDone.n, value: Number(dispDone.value) },
      savingsTotal: Number(savings.value),
      revenueMonth: Number(revenueMonth.value),
      revenueForecast: Number(revenueForecast.value),
      tasksPending: tasksPending.n,
      followupsLate: followupsLate.n,
    },
    agendaToday,
    charts: { salesByMonth, savingsByMonth, funnel, consultants },
  });
});

module.exports = router;
