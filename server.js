require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { authenticate } = require('./src/middleware/auth');
const { startJobs } = require('./src/jobs');

const authRoutes = require('./src/routes/auth');
const dashboard = require('./src/routes/dashboard');
const crm = require('./src/routes/crm');
const telecom = require('./src/routes/telecom');
const business = require('./src/routes/business');
const settings = require('./src/routes/settings');
const documents = require('./src/routes/documents');
const search = require('./src/routes/search');
const notifications = require('./src/routes/notifications');
const auditlog = require('./src/routes/auditlog');
const reports = require('./src/routes/reports');
const meta = require('./src/routes/meta');
const admin = require('./src/routes/admin');

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ------------------- API REST -------------------
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api', authenticate);
app.use('/api/meta', meta);
app.use('/api/dashboard', dashboard);
app.use('/api/companies', crm.companies);
app.use('/api/contacts', crm.contacts);
app.use('/api/persons', crm.persons);
app.use('/api/leads', crm.leadsExtraRoutes, crm.leads);
app.use('/api/agenda', crm.agendaExtra, crm.agenda);
app.use('/api/tasks', crm.tasks);
app.use('/api/operators', telecom.operators);
app.use('/api/plans', telecom.plans);
app.use('/api/lines', telecom.lines);
app.use('/api/invoices', telecom.invoices);
app.use('/api/analyses', telecom.analyses);
app.use('/api/disputes', telecom.disputes);
app.use('/api/adjustments', telecom.adjustments);
app.use('/api/contracts', business.contracts);
app.use('/api/revenues', business.revenues);
app.use('/api/commissions', business.commissions);
app.use('/api/segments', settings.segments);
app.use('/api/sources', settings.sources);
app.use('/api/loss-reasons', settings.lossReasons);
app.use('/api/teams', settings.teams);
app.use('/api/statuses', settings.statuses);
app.use('/api/users', settings.users);
app.use('/api/documents', documents);
app.use('/api/search', search);
app.use('/api/notifications', notifications);
app.use('/api/audit-log', auditlog);
app.use('/api/reports', reports);
app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ------------------- Frontend (PWA) -------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento central de erros.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'Tipo de arquivo não permitido') return res.status(400).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo excede o tamanho máximo' });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FableCRM rodando em http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') startJobs();
});
