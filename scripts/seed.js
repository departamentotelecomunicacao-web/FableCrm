// Seed inicial: tenant Fatura Expert, usuários por perfil, cadastros básicos.
// Com --demo, insere também dados de exemplo para demonstração do sistema.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DEMO = process.argv.includes('--demo');

const LEAD_STATUSES = [
  ['Novo', '#3b82f6'], ['Contatado', '#06b6d4'], ['Reunião', '#8b5cf6'],
  ['Análise', '#f59e0b'], ['Proposta', '#f97316'], ['Negociação', '#ec4899'],
  ['Fechado', '#22c55e'], ['Perdido', '#ef4444'],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const existing = await db.query(`SELECT id FROM tenants WHERE slug = 'fatura-expert'`);
    if (existing.rows.length) {
      console.log('Seed já aplicado (tenant fatura-expert existe). Nada a fazer.');
      await db.query('ROLLBACK');
      return;
    }

    const { rows: [tenant] } = await db.query(
      `INSERT INTO tenants (name, slug) VALUES ('Fatura Expert', 'fatura-expert') RETURNING id`);
    const t = tenant.id;

    const { rows: [team] } = await db.query(
      `INSERT INTO teams (tenant_id, name) VALUES ($1, 'Comercial') RETURNING id`, [t]);

    const hash = await bcrypt.hash('admin123', 10);
    const users = {};
    for (const [name, email, role] of [
      ['Administrador', 'admin@faturaexpert.com.br', 'admin'],
      ['Gestor Demo', 'gestor@faturaexpert.com.br', 'gestor'],
      ['Consultor Demo', 'comercial@faturaexpert.com.br', 'comercial'],
      ['Analista Demo', 'analista@faturaexpert.com.br', 'analista'],
      ['Financeiro Demo', 'financeiro@faturaexpert.com.br', 'financeiro'],
    ]) {
      const { rows: [u] } = await db.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, team_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [t, name, email, hash, role, team.id]);
      users[role] = u.id;
    }

    const statusIds = {};
    for (let i = 0; i < LEAD_STATUSES.length; i++) {
      const [name, color] = LEAD_STATUSES[i];
      const { rows: [s] } = await db.query(
        `INSERT INTO custom_statuses (tenant_id, context, name, color, sort_order, is_won, is_lost)
         VALUES ($1,'lead',$2,$3,$4,$5,$6) RETURNING id`,
        [t, name, color, i, name === 'Fechado', name === 'Perdido']);
      statusIds[name] = s.id;
    }

    const segIds = {};
    for (const s of ['Indústria', 'Comércio', 'Serviços', 'Saúde', 'Educação', 'Logística']) {
      const { rows: [r] } = await db.query(
        `INSERT INTO segments (tenant_id, name) VALUES ($1,$2) RETURNING id`, [t, s]);
      segIds[s] = r.id;
    }
    const srcIds = {};
    for (const s of ['Indicação', 'Site', 'Redes sociais', 'Prospecção ativa', 'Evento', 'Parceiro']) {
      const { rows: [r] } = await db.query(
        `INSERT INTO lead_sources (tenant_id, name) VALUES ($1,$2) RETURNING id`, [t, s]);
      srcIds[s] = r.id;
    }
    for (const s of ['Preço', 'Concorrência', 'Sem orçamento', 'Sem interesse', 'Sem retorno']) {
      await db.query(`INSERT INTO loss_reasons (tenant_id, name) VALUES ($1,$2)`, [t, s]);
    }

    const opIds = {};
    for (const [name, type, services] of [
      ['Vivo', 'Vivo', ['movel', 'fixa', 'fibra', 'link_dedicado', 'm2m_iot']],
      ['Claro', 'Claro', ['movel', 'fixa', 'fibra', 'tv']],
      ['TIM', 'TIM', ['movel', 'fixa', 'm2m_iot']],
      ['Oi', 'Oi', ['fixa', 'fibra']],
    ]) {
      const { rows: [r] } = await db.query(
        `INSERT INTO operators (tenant_id, name, type, services) VALUES ($1,$2,$3,$4) RETURNING id`,
        [t, name, type, services]);
      opIds[name] = r.id;
    }
    const planIds = {};
    for (const [op, name, st, fr, val] of [
      ['Vivo', 'Vivo Empresas 20GB', 'movel', '20GB', 79.90],
      ['Vivo', 'Vivo Fibra 500MB', 'fibra', '500 Mbps', 149.90],
      ['Claro', 'Claro Total 50GB', 'movel', '50GB', 119.90],
      ['TIM', 'TIM Black Empresa 40GB', 'movel', '40GB', 99.90],
    ]) {
      const { rows: [r] } = await db.query(
        `INSERT INTO plans (tenant_id, operator_id, name, service_type, franchise, monthly_value)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [t, opIds[op], name, st, fr, val]);
      planIds[name] = r.id;
    }

    console.log('Seed básico aplicado (tenant, usuários, cadastros).');

    if (DEMO) {
      const today = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
      const monthRef = (n) => { const d = new Date(today); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };

      const compIds = [];
      for (const [rs, nf, cnpj, seg, city, uf, cli] of [
        ['Metalúrgica Aurora Ltda', 'Aurora Metais', '12.345.678/0001-90', 'Indústria', 'São Paulo', 'SP', true],
        ['Transportadora Veloz S/A', 'Veloz Log', '98.765.432/0001-10', 'Logística', 'Campinas', 'SP', true],
        ['Clínica Bem Viver Ltda', 'Bem Viver', '11.222.333/0001-44', 'Saúde', 'Santos', 'SP', false],
      ]) {
        const { rows: [c] } = await db.query(
          `INSERT INTO companies (tenant_id, razao_social, nome_fantasia, cnpj, segment_id, employees_count, revenue_approx, city, state, is_client, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ativo') RETURNING id`,
          [t, rs, nf, cnpj, segIds[seg], 120, 2500000, city, uf, cli]);
        compIds.push(c.id);
        await db.query(
          `INSERT INTO company_contacts (tenant_id, company_id, name, role, phone, whatsapp, email, is_primary)
           VALUES ($1,$2,$3,'Financeiro','(11) 3333-0000','(11) 99999-0000',$4,TRUE)`,
          [t, c.id, `Contato ${nf}`, `contato@${nf.toLowerCase().replace(/\s/g, '')}.com.br`]);
      }

      const { rows: [person] } = await db.query(
        `INSERT INTO persons (tenant_id, name, cpf, phone, whatsapp, email, city, state, is_client)
         VALUES ($1,'João da Silva','123.456.789-00','(11) 98888-7777','(11) 98888-7777','joao.silva@email.com','São Paulo','SP',TRUE) RETURNING id`, [t]);

      const leadDefs = [
        ['Redução de custos Aurora Metais', compIds[0], 'Novo', 4500, 'Indicação'],
        ['Auditoria de faturas Veloz Log', compIds[1], 'Análise', 12000, 'Site'],
        ['Consultoria Bem Viver', compIds[2], 'Proposta', 6800, 'Prospecção ativa'],
        ['Plano PF João da Silva', null, 'Contatado', 900, 'Redes sociais'],
        ['Link dedicado Veloz Log', compIds[1], 'Fechado', 24000, 'Parceiro'],
        ['Frota M2M Aurora', compIds[0], 'Negociação', 8900, 'Evento'],
      ];
      const leadIds = [];
      for (let i = 0; i < leadDefs.length; i++) {
        const [title, comp, st, val, src] = leadDefs[i];
        const { rows: [l] } = await db.query(
          `INSERT INTO leads (tenant_id, title, company_id, person_id, source_id, consultant_id, status_id, estimated_value, position, closed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [t, title, comp, comp ? null : person.id, srcIds[src], users.comercial, statusIds[st], val, i,
            st === 'Fechado' ? new Date() : null]);
        leadIds.push(l.id);
      }

      const lineIds = [];
      for (const [comp, num, op, plan, val, cc] of [
        [compIds[0], '(11) 98765-0001', 'Vivo', 'Vivo Empresas 20GB', 79.90, 'Diretoria'],
        [compIds[0], '(11) 98765-0002', 'Vivo', 'Vivo Empresas 20GB', 79.90, 'Vendas'],
        [compIds[1], '(19) 97654-0003', 'Claro', 'Claro Total 50GB', 119.90, 'Operações'],
        [compIds[1], '(19) 97654-0004', 'TIM', 'TIM Black Empresa 40GB', 99.90, 'Frota'],
      ]) {
        const { rows: [l] } = await db.query(
          `INSERT INTO phone_lines (tenant_id, company_id, number, operator_id, plan_id, monthly_value, cost_center, responsible, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'Gestor de frota','ativa') RETURNING id`,
          [t, comp, num, opIds[op], planIds[plan], val, cc]);
        lineIds.push(l.id);
      }

      const invIds = [];
      for (const [comp, line, op, compet, amount, dueOff, paidOff, status] of [
        [compIds[0], lineIds[0], 'Vivo', monthRef(-2), 1890.5, -35, -33, 'paga'],
        [compIds[0], lineIds[1], 'Vivo', monthRef(-1), 2140.9, -5, null, 'atrasada'],
        [compIds[1], lineIds[2], 'Claro', monthRef(-1), 3420.0, -3, -1, 'paga'],
        [compIds[1], lineIds[3], 'TIM', monthRef(0), 980.4, 10, null, 'pendente'],
      ]) {
        const { rows: [inv] } = await db.query(
          `INSERT INTO invoices (tenant_id, company_id, line_id, operator_id, invoice_number, competence, amount, due_date, paid_at, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [t, comp, line, opIds[op], `FAT-${compet}-${line}`, compet, amount,
            iso(addDays(dueOff)), paidOff == null ? null : iso(addDays(paidOff)), status]);
        invIds.push(inv.id);
      }

      await db.query(
        `INSERT INTO audit_analyses (tenant_id, company_id, invoice_id, analyst_id, situation, description, savings_identified, recommendations)
         VALUES ($1,$2,$3,$4,'Cobrança indevida de serviços não contratados','Identificados serviços de terceiros (SVA) cobrados sem autorização em 2 linhas.',450.30,'Abrir contestação junto à operadora e solicitar bloqueio de SVA.')`,
        [t, compIds[0], invIds[1], users.analista]);
      await db.query(
        `INSERT INTO audit_analyses (tenant_id, company_id, invoice_id, analyst_id, situation, description, savings_identified, recommendations)
         VALUES ($1,$2,$3,$4,'Plano desalinhado ao uso','Franquia de dados 60% ociosa; plano menor atende o consumo.',280.00,'Readequar para plano de 20GB.')`,
        [t, compIds[1], invIds[2], users.analista]);

      await db.query(
        `INSERT INTO disputes (tenant_id, company_id, operator_id, invoice_id, protocol_number, contested_amount, status, responsible_id, notes)
         VALUES ($1,$2,$3,$4,'PROT-2026-00123',450.30,'em_andamento',$5,'Contestação de SVA não contratado.')`,
        [t, compIds[0], opIds.Vivo, invIds[1], users.analista]);
      await db.query(
        `INSERT INTO disputes (tenant_id, company_id, operator_id, protocol_number, contested_amount, status, result, recovered_amount, responsible_id, closed_at)
         VALUES ($1,$2,$3,'PROT-2026-00087',1200.00,'finalizada','parcial',800.00,$4,CURRENT_DATE - 10)`,
        [t, compIds[1], opIds.Claro, users.analista]);

      await db.query(
        `INSERT INTO plan_adjustments (tenant_id, company_id, line_id, old_plan, new_plan, old_value, new_value, monthly_savings, annual_savings, responsible_id, status)
         VALUES ($1,$2,$3,'Claro Total 50GB','Claro Total 20GB',119.90,79.90,40.00,480.00,$4,'implantada')`,
        [t, compIds[1], lineIds[2], users.analista]);

      const { rows: [contract] } = await db.query(
        `INSERT INTO contracts (tenant_id, type, company_id, start_date, end_date, months, value, renewal_type, status, notes)
         VALUES ($1,'consultoria',$2,CURRENT_DATE - 60, CURRENT_DATE + 305, 12, 2400.00,'automatica','ativo','Contrato de consultoria - fee mensal sobre economia.') RETURNING id`,
        [t, compIds[0]]);
      await db.query(
        `INSERT INTO contracts (tenant_id, type, company_id, start_date, end_date, months, value, renewal_type, status)
         VALUES ($1,'auditoria',$2,CURRENT_DATE - 200, CURRENT_DATE + 20, 8, 1800.00,'manual','ativo')`,
        [t, compIds[1]]);

      const { rows: [rev] } = await db.query(
        `INSERT INTO revenues (tenant_id, company_id, contract_id, description, amount, due_date, paid_at, status)
         VALUES ($1,$2,$3,'Fee mensal - consultoria',2400.00,$4,$5,'paga') RETURNING id`,
        [t, compIds[0], contract.id, iso(addDays(-10)), iso(addDays(-8))]);
      await db.query(
        `INSERT INTO revenues (tenant_id, company_id, contract_id, description, amount, due_date, status)
         VALUES ($1,$2,$3,'Fee mensal - consultoria',2400.00,$4,'pendente')`,
        [t, compIds[0], contract.id, iso(addDays(20))]);
      await db.query(
        `INSERT INTO commissions (tenant_id, consultant_id, revenue_id, reference_month, base_amount, percent, amount, status)
         VALUES ($1,$2,$3,$4,2400.00,10.00,240.00,'pendente')`,
        [t, users.comercial, rev.id, monthRef(0)]);

      await db.query(
        `INSERT INTO tasks (tenant_id, title, description, assignee_id, created_by, due_date, priority, status, company_id)
         VALUES ($1,'Enviar proposta Bem Viver','Preparar proposta de auditoria completa.',$2,$3,$4,'alta','pendente',$5)`,
        [t, users.comercial, users.gestor, iso(addDays(2)), compIds[2]]);
      await db.query(
        `INSERT INTO tasks (tenant_id, title, assignee_id, created_by, due_date, priority, status, company_id)
         VALUES ($1,'Cobrar retorno da Vivo (protocolo PROT-2026-00123)',$2,$2,$3,'media','em_andamento',$4)`,
        [t, users.analista, iso(addDays(-1)), compIds[0]]);

      const at = (offsetDays, hour) => { const d = addDays(offsetDays); d.setHours(hour, 0, 0, 0); return d; };
      await db.query(
        `INSERT INTO agenda_events (tenant_id, title, type, start_at, end_at, user_id, company_id, lead_id, location)
         VALUES ($1,'Reunião de apresentação - Bem Viver','reuniao',$2,$3,$4,$5,$6,'Google Meet')`,
        [t, at(0, 14), at(0, 15), users.comercial, compIds[2], leadIds[2]]);
      await db.query(
        `INSERT INTO agenda_events (tenant_id, title, type, start_at, user_id, company_id, lead_id)
         VALUES ($1,'Follow-up proposta Aurora','follow_up',$2,$3,$4,$5)`,
        [t, at(-2, 10), users.comercial, compIds[0], leadIds[0]]);

      console.log('Dados de demonstração inseridos.');
    }

    await db.query('COMMIT');
    console.log('Seed concluído. Login: admin@faturaexpert.com.br / admin123');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((err) => { console.error('Falha no seed:', err); process.exit(1); });
