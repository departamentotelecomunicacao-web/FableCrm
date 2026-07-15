// Relatórios com filtro por período e exportação em Excel (xlsx) e PDF.
const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query } = require('../db');
const { can } = require('../middleware/auth');
const { logAudit } = require('../audit');

const clientName = `COALESCE(c.nome_fantasia, c.razao_social, p.name)`;
const money = (v) => v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v) => v == null ? '' : new Date(v).toLocaleDateString('pt-BR');

// Cada relatório: título, colunas (label + formatador) e SQL com $1=tenant,
// $2=data inicial (ou null), $3=data final (ou null).
const REPORTS = {
  clients: {
    title: 'Relatório de Clientes',
    columns: [
      ['name', 'Cliente'], ['doc', 'CNPJ/CPF'], ['type', 'Tipo'], ['segment', 'Segmento'],
      ['city', 'Cidade'], ['state', 'UF'], ['status', 'Status'], ['created_at', 'Cadastro', dt],
    ],
    sql: `SELECT razao_social AS name, cnpj AS doc, 'PJ' AS type, s.name AS segment, city, state, c.status, c.created_at
          FROM companies c LEFT JOIN segments s ON s.id=c.segment_id
          WHERE c.tenant_id=$1 AND c.is_client AND ($2::date IS NULL OR c.created_at>=$2) AND ($3::date IS NULL OR c.created_at<$3::date+1)
          UNION ALL
          SELECT name, cpf, 'PF', NULL, city, state, status, created_at FROM persons
          WHERE tenant_id=$1 AND is_client AND ($2::date IS NULL OR created_at>=$2) AND ($3::date IS NULL OR created_at<$3::date+1)
          ORDER BY name`,
  },
  leads: {
    title: 'Relatório de Leads',
    columns: [
      ['title', 'Lead'], ['client_name', 'Cliente'], ['status_name', 'Status'], ['source_name', 'Origem'],
      ['consultant_name', 'Consultor'], ['estimated_value', 'Valor estimado', money], ['created_at', 'Criado em', dt],
    ],
    sql: `SELECT t.title, ${clientName} AS client_name, st.name AS status_name, ls.name AS source_name,
            u.name AS consultant_name, t.estimated_value, t.created_at
          FROM leads t
          LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          LEFT JOIN custom_statuses st ON st.id=t.status_id LEFT JOIN lead_sources ls ON ls.id=t.source_id
          LEFT JOIN users u ON u.id=t.consultant_id
          WHERE t.tenant_id=$1 AND ($2::date IS NULL OR t.created_at>=$2) AND ($3::date IS NULL OR t.created_at<$3::date+1)
          ORDER BY t.created_at DESC`,
  },
  conversions: {
    title: 'Relatório de Conversões do Funil',
    columns: [
      ['status', 'Etapa'], ['n', 'Leads'], ['value', 'Valor estimado', money], ['pct', '% do total'],
    ],
    sql: `WITH base AS (
            SELECT st.name AS status, st.sort_order, count(l.id)::int AS n, COALESCE(sum(l.estimated_value),0) AS value
            FROM custom_statuses st
            LEFT JOIN leads l ON l.status_id=st.id AND l.tenant_id=$1
              AND ($2::date IS NULL OR l.created_at>=$2) AND ($3::date IS NULL OR l.created_at<$3::date+1)
            WHERE st.tenant_id=$1 AND st.context='lead' GROUP BY st.id)
          SELECT status, n, value,
            CASE WHEN sum(n) OVER () = 0 THEN '0%' ELSE round(100.0*n/sum(n) OVER (),1) || '%' END AS pct
          FROM base ORDER BY sort_order`,
  },
  disputes: {
    title: 'Relatório de Contestações',
    columns: [
      ['protocol_number', 'Protocolo'], ['client_name', 'Cliente'], ['operator_name', 'Operadora'],
      ['dispute_date', 'Data', dt], ['status', 'Status'], ['result', 'Resultado'],
      ['contested_amount', 'Valor contestado', money], ['recovered_amount', 'Valor recuperado', money],
      ['responsible_name', 'Responsável'],
    ],
    sql: `SELECT t.protocol_number, ${clientName} AS client_name, o.name AS operator_name,
            t.dispute_date, t.status, t.result, t.contested_amount, t.recovered_amount, u.name AS responsible_name
          FROM disputes t
          LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          LEFT JOIN operators o ON o.id=t.operator_id LEFT JOIN users u ON u.id=t.responsible_id
          WHERE t.tenant_id=$1 AND ($2::date IS NULL OR t.dispute_date>=$2) AND ($3::date IS NULL OR t.dispute_date<=$3)
          ORDER BY t.dispute_date DESC`,
  },
  savings: {
    title: 'Relatório de Economia Gerada',
    columns: [
      ['origem', 'Origem'], ['client_name', 'Cliente'], ['data', 'Data', dt],
      ['descricao', 'Descrição'], ['valor', 'Economia', money],
    ],
    sql: `SELECT 'Contestação' AS origem, ${clientName} AS client_name, t.closed_at AS data,
            'Protocolo ' || coalesce(t.protocol_number,'-') AS descricao, t.recovered_amount AS valor
          FROM disputes t LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          WHERE t.tenant_id=$1 AND t.status='finalizada' AND t.recovered_amount IS NOT NULL
            AND ($2::date IS NULL OR t.closed_at>=$2) AND ($3::date IS NULL OR t.closed_at<=$3)
          UNION ALL
          SELECT 'Análise de fatura', ${clientName}, t.analysis_date, coalesce(t.situation,'-'), t.savings_identified
          FROM audit_analyses t LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          WHERE t.tenant_id=$1 AND t.savings_identified IS NOT NULL
            AND ($2::date IS NULL OR t.analysis_date>=$2) AND ($3::date IS NULL OR t.analysis_date<=$3)
          UNION ALL
          SELECT 'Readequação (anual)', ${clientName}, t.adjustment_date,
            coalesce(t.old_plan,'') || ' -> ' || coalesce(t.new_plan,''), t.annual_savings
          FROM plan_adjustments t LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          WHERE t.tenant_id=$1 AND t.status='implantada' AND t.annual_savings IS NOT NULL
            AND ($2::date IS NULL OR t.adjustment_date>=$2) AND ($3::date IS NULL OR t.adjustment_date<=$3)
          ORDER BY data DESC NULLS LAST`,
  },
  revenue: {
    title: 'Relatório de Receita',
    columns: [
      ['client_name', 'Cliente'], ['description', 'Descrição'], ['due_date', 'Vencimento', dt],
      ['paid_at', 'Pagamento', dt], ['status', 'Status'], ['amount', 'Valor', money],
    ],
    sql: `SELECT ${clientName} AS client_name, t.description, t.due_date, t.paid_at, t.status, t.amount
          FROM revenues t LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          WHERE t.tenant_id=$1 AND ($2::date IS NULL OR t.due_date>=$2) AND ($3::date IS NULL OR t.due_date<=$3)
          ORDER BY t.due_date DESC NULLS LAST`,
  },
  consultants: {
    title: 'Relatório de Performance por Consultor',
    columns: [
      ['name', 'Consultor'], ['total', 'Leads no período'], ['won', 'Fechados'],
      ['conv', 'Conversão'], ['value', 'Valor fechado', money], ['commissions', 'Comissões', money],
    ],
    sql: `SELECT u.name, count(l.id)::int AS total,
            count(l.id) FILTER (WHERE st.is_won)::int AS won,
            CASE WHEN count(l.id)=0 THEN '0%' ELSE round(100.0*count(l.id) FILTER (WHERE st.is_won)/count(l.id),1) || '%' END AS conv,
            COALESCE(sum(l.estimated_value) FILTER (WHERE st.is_won),0) AS value,
            COALESCE((SELECT sum(cm.amount) FROM commissions cm WHERE cm.consultant_id=u.id AND cm.tenant_id=$1),0) AS commissions
          FROM users u
          LEFT JOIN leads l ON l.consultant_id=u.id AND l.tenant_id=$1
            AND ($2::date IS NULL OR l.created_at>=$2) AND ($3::date IS NULL OR l.created_at<$3::date+1)
          LEFT JOIN custom_statuses st ON st.id=l.status_id
          WHERE u.tenant_id=$1 AND u.active GROUP BY u.id ORDER BY value DESC`,
  },
  operators: {
    title: 'Relatório por Operadora',
    columns: [
      ['name', 'Operadora'], ['lines', 'Linhas'], ['lines_value', 'Valor mensal linhas', money],
      ['invoices', 'Faturas'], ['invoices_value', 'Valor faturas', money],
      ['disputes', 'Contestações'], ['recovered', 'Recuperado', money],
    ],
    sql: `SELECT o.name,
            (SELECT count(*) FROM phone_lines pl WHERE pl.operator_id=o.id AND pl.tenant_id=$1)::int AS lines,
            COALESCE((SELECT sum(pl.monthly_value) FROM phone_lines pl WHERE pl.operator_id=o.id AND pl.tenant_id=$1),0) AS lines_value,
            (SELECT count(*) FROM invoices i WHERE i.operator_id=o.id AND i.tenant_id=$1
              AND ($2::date IS NULL OR i.due_date>=$2) AND ($3::date IS NULL OR i.due_date<=$3))::int AS invoices,
            COALESCE((SELECT sum(i.amount) FROM invoices i WHERE i.operator_id=o.id AND i.tenant_id=$1
              AND ($2::date IS NULL OR i.due_date>=$2) AND ($3::date IS NULL OR i.due_date<=$3)),0) AS invoices_value,
            (SELECT count(*) FROM disputes d WHERE d.operator_id=o.id AND d.tenant_id=$1)::int AS disputes,
            COALESCE((SELECT sum(d.recovered_amount) FROM disputes d WHERE d.operator_id=o.id AND d.tenant_id=$1),0) AS recovered
          FROM operators o WHERE o.tenant_id=$1 ORDER BY o.name`,
  },
  lines: {
    title: 'Relatório de Linhas',
    columns: [
      ['number', 'Número'], ['client_name', 'Cliente'], ['operator_name', 'Operadora'],
      ['plan_name', 'Plano'], ['cost_center', 'Centro de custo'], ['status', 'Status'],
      ['monthly_value', 'Valor mensal', money],
    ],
    sql: `SELECT t.number, ${clientName} AS client_name, o.name AS operator_name, pl.name AS plan_name,
            t.cost_center, t.status, t.monthly_value
          FROM phone_lines t
          LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          LEFT JOIN operators o ON o.id=t.operator_id LEFT JOIN plans pl ON pl.id=t.plan_id
          WHERE t.tenant_id=$1 AND ($2::date IS NULL OR t.created_at>=$2) AND ($3::date IS NULL OR t.created_at<$3::date+1)
          ORDER BY t.number`,
  },
  invoices: {
    title: 'Relatório de Faturas Analisadas',
    columns: [
      ['invoice_number', 'Fatura'], ['client_name', 'Cliente'], ['operator_name', 'Operadora'],
      ['competence', 'Competência'], ['amount', 'Valor', money], ['due_date', 'Vencimento', dt],
      ['status', 'Status'], ['analyses', 'Análises'], ['savings', 'Economia identificada', money],
    ],
    sql: `SELECT t.invoice_number, ${clientName} AS client_name, o.name AS operator_name, t.competence,
            t.amount, t.due_date, t.status,
            (SELECT count(*) FROM audit_analyses a WHERE a.invoice_id=t.id)::int AS analyses,
            COALESCE((SELECT sum(a.savings_identified) FROM audit_analyses a WHERE a.invoice_id=t.id),0) AS savings
          FROM invoices t
          LEFT JOIN companies c ON c.id=t.company_id LEFT JOIN persons p ON p.id=t.person_id
          LEFT JOIN operators o ON o.id=t.operator_id
          WHERE t.tenant_id=$1 AND ($2::date IS NULL OR t.due_date>=$2) AND ($3::date IS NULL OR t.due_date<=$3)
          ORDER BY t.due_date DESC NULLS LAST`,
  },
};

const router = express.Router();

router.get('/', can('reports', 'r'), (req, res) => {
  res.json(Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })));
});

router.get('/:type', can('reports', 'r'), async (req, res) => {
  const report = REPORTS[req.params.type];
  if (!report) return res.status(404).json({ error: 'Relatório inexistente' });
  const { from = null, to = null, format = 'json' } = req.query;
  const { rows } = await query(report.sql, [req.user.tenantId, from, to]);
  const period = from || to ? `Período: ${from ? dt(from) : '...'} a ${to ? dt(to) : '...'}` : 'Período: completo';

  if (format === 'json') {
    return res.json({ title: report.title, period, columns: report.columns.map(([key, label]) => ({ key, label })), rows });
  }

  await logAudit({ req, entity: 'reports', entityId: null, action: `export_${format}_${req.params.type}` });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(report.title.slice(0, 31));
    ws.addRow([report.title]).font = { bold: true, size: 14 };
    ws.addRow([period]);
    ws.addRow([]);
    const header = ws.addRow(report.columns.map(([, label]) => label));
    header.font = { bold: true };
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });
    for (const row of rows) {
      ws.addRow(report.columns.map(([key, , fmt]) => {
        const v = row[key];
        if (fmt === money) return v == null ? null : Number(v);
        if (fmt === dt) return v == null ? null : new Date(v);
        return v;
      }));
    }
    report.columns.forEach(([key, label], i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.max(label.length + 4, 16);
      const [, , fmt] = report.columns[i];
      if (fmt === money) col.numFmt = 'R$ #,##0.00';
      if (fmt === dt) col.numFmt = 'dd/mm/yyyy';
    });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${req.params.type}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: report.columns.length > 6 ? 'landscape' : 'portrait' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${req.params.type}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(report.title);
    doc.fontSize(9).font('Helvetica').fillColor('#555').text(`${period} — gerado em ${new Date().toLocaleString('pt-BR')} — FableCRM / Fatura Expert`);
    doc.moveDown(0.8);

    const pageW = doc.page.width - 72;
    const colW = pageW / report.columns.length;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(36, y - 2, pageW, 16).fill('#1e293b');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
      report.columns.forEach(([, label], i) => {
        doc.text(label, 38 + i * colW, y + 2, { width: colW - 4, ellipsis: true, lineBreak: false });
      });
      doc.fillColor('#111').font('Helvetica').fontSize(8);
      doc.y = y + 18;
    };
    drawHeader();
    let alt = false;
    for (const row of rows) {
      if (doc.y > doc.page.height - 60) { doc.addPage(); drawHeader(); alt = false; }
      const y = doc.y;
      if (alt) { doc.rect(36, y - 2, pageW, 14).fill('#f1f5f9'); doc.fillColor('#111'); }
      report.columns.forEach(([key, , fmt], i) => {
        const v = fmt ? fmt(row[key]) : (row[key] == null ? '' : String(row[key]));
        doc.text(v, 38 + i * colW, y, { width: colW - 4, ellipsis: true, lineBreak: false });
      });
      doc.y = y + 14;
      alt = !alt;
    }
    if (!rows.length) doc.text('Nenhum registro no período.', 38);
    doc.end();
    return;
  }

  res.status(400).json({ error: 'Formato inválido (use json, xlsx ou pdf)' });
});

module.exports = router;
