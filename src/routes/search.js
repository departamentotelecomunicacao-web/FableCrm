// Pesquisa global: cliente, empresa, linha, CPF, CNPJ, telefone, e-mail,
// número de fatura e leads — tudo numa única consulta.
const express = require('express');
const { query } = require('../db');
const { can } = require('../middleware/auth');

const router = express.Router();

router.get('/', can('search', 'r'), async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, '');
  const digitsLike = digits.length >= 4 ? `%${digits}%` : null;
  const t = req.user.tenantId;

  const [companies, persons, lines, invoices, leads, contacts] = await Promise.all([
    query(`SELECT id, razao_social AS title, coalesce(nome_fantasia,'') || ' • ' || coalesce(cnpj,'') AS subtitle
           FROM companies WHERE tenant_id=$1 AND (razao_social ILIKE $2 OR nome_fantasia ILIKE $2
             OR cnpj ILIKE $2 OR ($3::text IS NOT NULL AND regexp_replace(coalesce(cnpj,''),'\\D','','g') LIKE $3))
           LIMIT 8`, [t, like, digitsLike]),
    query(`SELECT id, name AS title, coalesce(cpf,'') || ' • ' || coalesce(email,'') AS subtitle
           FROM persons WHERE tenant_id=$1 AND (name ILIKE $2 OR cpf ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2
             OR ($3::text IS NOT NULL AND (regexp_replace(coalesce(cpf,''),'\\D','','g') LIKE $3
               OR regexp_replace(coalesce(phone,''),'\\D','','g') LIKE $3)))
           LIMIT 8`, [t, like, digitsLike]),
    query(`SELECT l.id, l.number AS title,
             coalesce(o.name,'') || ' • ' || coalesce(c.nome_fantasia, c.razao_social, p.name, '') AS subtitle
           FROM phone_lines l
           LEFT JOIN operators o ON o.id=l.operator_id
           LEFT JOIN companies c ON c.id=l.company_id
           LEFT JOIN persons p ON p.id=l.person_id
           WHERE l.tenant_id=$1 AND (l.number ILIKE $2
             OR ($3::text IS NOT NULL AND regexp_replace(l.number,'\\D','','g') LIKE $3))
           LIMIT 8`, [t, like, digitsLike]),
    query(`SELECT i.id, coalesce(i.invoice_number, 'Fatura #' || i.id) AS title,
             coalesce(i.competence,'') || ' • ' || coalesce(c.nome_fantasia, c.razao_social, p.name, '') AS subtitle
           FROM invoices i
           LEFT JOIN companies c ON c.id=i.company_id
           LEFT JOIN persons p ON p.id=i.person_id
           WHERE i.tenant_id=$1 AND (i.invoice_number ILIKE $2 OR i.competence ILIKE $2)
           LIMIT 8`, [t, like]),
    query(`SELECT id, title, coalesce(contact_name,'') || ' ' || coalesce(contact_email,'') AS subtitle
           FROM leads WHERE tenant_id=$1 AND (title ILIKE $2 OR contact_name ILIKE $2
             OR contact_email ILIKE $2 OR contact_phone ILIKE $2)
           LIMIT 8`, [t, like]),
    query(`SELECT cc.company_id AS id, cc.name AS title,
             'Contato de ' || coalesce(c.nome_fantasia, c.razao_social) AS subtitle
           FROM company_contacts cc JOIN companies c ON c.id = cc.company_id
           WHERE cc.tenant_id=$1 AND (cc.name ILIKE $2 OR cc.email ILIKE $2 OR cc.phone ILIKE $2 OR cc.whatsapp ILIKE $2)
           LIMIT 8`, [t, like]),
  ]);

  const tag = (rows, type) => rows.rows.map((r) => ({ ...r, type }));
  res.json({
    results: [
      ...tag(companies, 'company'), ...tag(persons, 'person'), ...tag(contacts, 'company'),
      ...tag(lines, 'line'), ...tag(invoices, 'invoice'), ...tag(leads, 'lead'),
    ],
  });
});

module.exports = router;
