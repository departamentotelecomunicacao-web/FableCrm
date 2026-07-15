# FableCRM — CRM da Fatura Expert

CRM completo estilo RD Station para gestão comercial e de telefonia da Fatura Expert:
funil de leads em kanban, gestão de linhas e faturas, auditoria de faturas, contestações,
readequação de planos, contratos, financeiro, relatórios e muito mais.

![stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Express%20%2B%20PostgreSQL-blue)

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 18+ / Express 5 (API REST) |
| Banco | PostgreSQL 13+ |
| Autenticação | JWT + bcrypt |
| Frontend | SPA responsiva em JavaScript puro (sem build), instalável como **PWA** |
| Exportações | Excel (ExcelJS) e PDF (PDFKit) |
| Agendador | node-cron (backup automático + notificações) |

## Como rodar

```bash
# 1. Dependências
npm install

# 2. Configuração
cp .env.example .env        # ajuste DATABASE_URL e JWT_SECRET

# 3. Banco de dados (crie o banco antes: createdb fablecrm)
npm run migrate             # cria as tabelas
npm run seed                # tenant Fatura Expert + usuários + cadastros básicos
# ou: npm run seed:demo     # o mesmo + dados de demonstração

# 4. Ícones do PWA (já versionados; regenere se quiser)
npm run gen:icons

# 5. Subir
npm start                   # http://localhost:3000
```

### Usuários criados pelo seed (senha inicial: `admin123` — troque no primeiro acesso)

| Perfil | E-mail |
|---|---|
| Administrador | admin@faturaexpert.com.br |
| Gestor | gestor@faturaexpert.com.br |
| Comercial | comercial@faturaexpert.com.br |
| Analista | analista@faturaexpert.com.br |
| Financeiro | financeiro@faturaexpert.com.br |

## Funcionalidades

- **Dashboard** — clientes ativos, novos leads, propostas, fechamentos, contestações
  (em andamento/finalizadas), economia gerada, receita do mês e prevista, tarefas
  pendentes, follow-ups atrasados e agenda do dia; gráficos de vendas por mês,
  economia por mês, conversão do funil e performance por consultor.
- **CRM comercial** — leads com kanban (arrastar e soltar), 8 etapas configuráveis,
  origem, consultor, valor estimado, motivo de perda, comentários e histórico completo.
- **Cadastros** — empresas (razão social, CNPJ, IE, segmento, funcionários, faturamento,
  endereço, site…) com responsáveis (nome, cargo, telefone, WhatsApp, e-mail) e
  documentos anexados; pessoas físicas (CPF, nascimento, contatos, endereço).
- **Agenda** — reuniões, ligações, retornos, follow-ups e compromissos; exportação
  iCalendar (.ics) para importar no Google Agenda e link "Adicionar ao Google Agenda"
  por evento.
- **Tarefas** — responsável, prazo, prioridade, status e comentários.
- **Telefonia** — operadoras (Vivo, Claro, TIM, Oi, outras) com serviços (móvel, fixa,
  fibra, TV, links dedicados, M2M/IoT), planos, e linhas por cliente (número, operadora,
  plano, franquia, valor, responsável, centro de custo, status).
- **Faturas** — competência, valor, operadora, vencimento, pagamento, observações,
  upload de PDF e histórico completo.
- **Auditoria de faturas** — analista, data, situação encontrada, descrição, economia
  identificada e recomendações.
- **Contestações** — operadora, protocolo, valor contestado, status, responsável,
  resultado (aprovada/negada/parcial) e valor recuperado.
- **Readequação de planos** — plano antigo/novo, economia mensal e anual (calculadas
  automaticamente), responsável e status.
- **Contratos** — tipo, cliente, vigência, valor, renovação e anexo do contrato.
- **Financeiro** — receitas (cliente, valor, vencimento, pagamento) e comissões dos
  consultores (base × percentual).
- **Documentos** — contratos, procurações, faturas, relatórios, prints e comprovantes,
  com download autenticado por tenant.
- **Relatórios** — 10 relatórios com filtro por período e exportação em **Excel e PDF**:
  clientes, leads, conversões, contestações, economia gerada, receita, consultores,
  operadoras, linhas e faturas analisadas.
- **Pesquisa global** — cliente, empresa, linha, CPF, CNPJ, telefone, e-mail e número
  de fatura, com sugestões instantâneas na barra superior.
- **Histórico completo** — todo registro guarda quem alterou, quando e o quê
  (auditoria campo a campo, com valores antes/depois).
- **Notificações automáticas** — follow-ups atrasados, faturas a vencer, contestações
  paradas, contratos vencendo e tarefas no prazo (job de hora em hora, com deduplicação).
- **Configurações** — operadoras, planos, status do funil, segmentos, motivos de perda,
  equipes e usuários.

## Segurança e arquitetura

- **Multiempresa**: toda tabela de negócio carrega `tenant_id`; o token JWT carrega o
  tenant e todas as consultas são automaticamente escopadas — pronto para novas empresas.
- **Perfis e permissões**: administrador, gestor, comercial, analista e financeiro, com
  matriz de permissões por módulo (leitura/escrita) aplicada na API e no menu
  (`src/permissions.js`).
- **Senhas** com hash bcrypt; **JWT** com expiração configurável.
- **Auditoria**: middleware registra criação/alteração/exclusão/login com diff de campos,
  usuário, IP e data em `audit_log`.
- **Backup automático**: `pg_dump` comprimido diário (cron configurável no `.env`),
  retenção automática e acionamento manual pela tela de Configurações (admin).
- **PWA**: manifesto + service worker (cache dos estáticos, API sempre na rede) —
  instalável no celular e no desktop.

## Estrutura

```
server.js               # entrada: Express, rotas, SPA, jobs
db/schema.sql           # schema completo do PostgreSQL
scripts/                # migrate, seed (com --demo), backup, gen-icons
src/
  crud.js               # fábrica de CRUD (tenant + permissão + auditoria + histórico)
  permissions.js        # matriz de permissões por perfil
  audit.js              # registro de auditoria com diff
  jobs.js               # cron: backup + notificações
  middleware/auth.js    # JWT (sign/verify) e autorização por módulo
  routes/               # auth, dashboard, crm, telecom, business, settings,
                        # documents, reports, search, notifications, auditlog, meta, admin
public/                 # SPA (PWA): index.html, css, js/views, manifest, sw.js, ícones
```

## API

Todas as rotas ficam sob `/api` e exigem `Authorization: Bearer <token>`
(exceto `/api/auth/login` e `/api/health`). Recursos CRUD seguem o padrão:

```
GET    /api/<recurso>?q=&page=&limit=&from=&to=&<filtros>
GET    /api/<recurso>/:id
POST   /api/<recurso>
PUT    /api/<recurso>/:id
DELETE /api/<recurso>/:id
GET    /api/<recurso>/:id/history     # histórico de alterações
```

Rotas especiais: `PATCH /api/leads/:id/move` (kanban), `GET /api/agenda/export.ics`,
`GET /api/reports/:tipo?format=json|xlsx|pdf`, `GET /api/search?q=`,
`POST /api/documents` (multipart), `GET /api/documents/:id/download`,
`POST /api/admin/backup`.

## Integração com Google Agenda

Duas formas prontas: exportação `.ics` de toda a agenda (importável em
calendar.google.com → Configurações → Importar) e botão "📅" em cada compromisso que
abre o evento pré-preenchido no Google Agenda. Para sincronização bidirecional via
OAuth, basta preencher o `google_event_id` já previsto no schema em uma evolução futura.
