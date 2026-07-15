// Metadados para os formulários do frontend: listas de usuários, operadoras,
// planos, status, segmentos, origens, motivos de perda, equipes, clientes.
const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const t = [req.user.tenantId];
  const [users, operators, plans, statuses, segments, sources, lossReasons, teams, companies, persons] =
    await Promise.all([
      query(`SELECT id, name, role FROM users WHERE tenant_id=$1 AND active ORDER BY name`, t),
      query(`SELECT id, name, type FROM operators WHERE tenant_id=$1 AND active ORDER BY name`, t),
      query(`SELECT id, name, operator_id, service_type, monthly_value FROM plans WHERE tenant_id=$1 AND active ORDER BY name`, t),
      query(`SELECT id, context, name, color, sort_order, is_won, is_lost FROM custom_statuses WHERE tenant_id=$1 ORDER BY sort_order`, t),
      query(`SELECT id, name FROM segments WHERE tenant_id=$1 ORDER BY name`, t),
      query(`SELECT id, name FROM lead_sources WHERE tenant_id=$1 ORDER BY name`, t),
      query(`SELECT id, name FROM loss_reasons WHERE tenant_id=$1 ORDER BY name`, t),
      query(`SELECT id, name FROM teams WHERE tenant_id=$1 ORDER BY name`, t),
      query(`SELECT id, COALESCE(nome_fantasia, razao_social) AS name FROM companies WHERE tenant_id=$1 ORDER BY 2 LIMIT 1000`, t),
      query(`SELECT id, name FROM persons WHERE tenant_id=$1 ORDER BY name LIMIT 1000`, t),
    ]);
  res.json({
    users: users.rows, operators: operators.rows, plans: plans.rows,
    statuses: statuses.rows, segments: segments.rows, sources: sources.rows,
    lossReasons: lossReasons.rows, teams: teams.rows,
    companies: companies.rows, persons: persons.rows,
  });
});

module.exports = router;
