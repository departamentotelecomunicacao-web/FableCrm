-- =============================================================
-- FableCRM - Schema PostgreSQL
-- Arquitetura multiempresa: toda tabela de negócio tem tenant_id
-- =============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','gestor','comercial','analista','financeiro')),
  phone         TEXT,
  team_id       INT REFERENCES teams(id),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- ------------------- Configurações (cadastros) -------------------

CREATE TABLE IF NOT EXISTS segments (
  id        SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  name      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_sources (
  id        SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  name      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loss_reasons (
  id        SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  name      TEXT NOT NULL
);

-- Status configuráveis (usados no funil de leads e outros contextos)
CREATE TABLE IF NOT EXISTS custom_statuses (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  context    TEXT NOT NULL DEFAULT 'lead',
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#64748b',
  sort_order INT NOT NULL DEFAULT 0,
  is_won     BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS operators (
  id        SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  name      TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'Outras' CHECK (type IN ('Vivo','Claro','TIM','Oi','Outras')),
  services  TEXT[] NOT NULL DEFAULT '{}', -- movel, fixa, fibra, tv, link_dedicado, m2m_iot
  notes     TEXT,
  active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  operator_id   INT REFERENCES operators(id),
  name          TEXT NOT NULL,
  service_type  TEXT NOT NULL DEFAULT 'movel' CHECK (service_type IN ('movel','fixa','fibra','tv','link_dedicado','m2m_iot')),
  franchise     TEXT,
  monthly_value NUMERIC(14,2),
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------- Clientes -------------------

CREATE TABLE IF NOT EXISTS companies (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  razao_social    TEXT NOT NULL,
  nome_fantasia   TEXT,
  cnpj            TEXT,
  ie              TEXT,
  segment_id      INT REFERENCES segments(id),
  employees_count INT,
  revenue_approx  NUMERIC(16,2),
  address         TEXT,
  city            TEXT,
  state           TEXT,
  cep             TEXT,
  site            TEXT,
  notes           TEXT,
  is_client       BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','prospect')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT,
  phone      TEXT,
  whatsapp   TEXT,
  email      TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS persons (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  name       TEXT NOT NULL,
  cpf        TEXT,
  birth_date DATE,
  address    TEXT,
  city       TEXT,
  state      TEXT,
  cep        TEXT,
  phone      TEXT,
  whatsapp   TEXT,
  email      TEXT,
  notes      TEXT,
  is_client  BOOLEAN NOT NULL DEFAULT FALSE,
  status     TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','prospect')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------- CRM Comercial -------------------

CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  company_id      INT REFERENCES companies(id),
  person_id       INT REFERENCES persons(id),
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  source_id       INT REFERENCES lead_sources(id),
  consultant_id   INT REFERENCES users(id),
  status_id       INT REFERENCES custom_statuses(id),
  estimated_value NUMERIC(14,2),
  loss_reason_id  INT REFERENCES loss_reasons(id),
  notes           TEXT,
  position        INT NOT NULL DEFAULT 0,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  entity     TEXT NOT NULL,
  entity_id  INT NOT NULL,
  user_id    INT REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_events (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'compromisso' CHECK (type IN ('reuniao','ligacao','retorno','follow_up','compromisso')),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  all_day         BOOLEAN NOT NULL DEFAULT FALSE,
  user_id         INT REFERENCES users(id),
  company_id      INT REFERENCES companies(id),
  person_id       INT REFERENCES persons(id),
  lead_id         INT REFERENCES leads(id),
  location        TEXT,
  notes           TEXT,
  done            BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  tenant_id    INT NOT NULL REFERENCES tenants(id),
  title        TEXT NOT NULL,
  description  TEXT,
  assignee_id  INT REFERENCES users(id),
  created_by   INT REFERENCES users(id),
  due_date     DATE,
  priority     TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  company_id   INT REFERENCES companies(id),
  person_id    INT REFERENCES persons(id),
  lead_id      INT REFERENCES leads(id),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------- Telefonia -------------------

CREATE TABLE IF NOT EXISTS phone_lines (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  company_id      INT REFERENCES companies(id),
  person_id       INT REFERENCES persons(id),
  number          TEXT NOT NULL,
  operator_id     INT REFERENCES operators(id),
  plan_id         INT REFERENCES plans(id),
  franchise       TEXT,
  monthly_value   NUMERIC(14,2),
  responsible     TEXT,
  cost_center     TEXT,
  status          TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','cancelada','portada')),
  activation_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL REFERENCES tenants(id),
  company_id     INT REFERENCES companies(id),
  person_id      INT REFERENCES persons(id),
  line_id        INT REFERENCES phone_lines(id),
  operator_id    INT REFERENCES operators(id),
  invoice_number TEXT,
  competence     TEXT, -- AAAA-MM
  amount         NUMERIC(14,2),
  due_date       DATE,
  paid_at        DATE,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','atrasada','contestada','cancelada')),
  notes          TEXT,
  document_id    INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_analyses (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INT NOT NULL REFERENCES tenants(id),
  company_id         INT REFERENCES companies(id),
  person_id          INT REFERENCES persons(id),
  invoice_id         INT REFERENCES invoices(id),
  analyst_id         INT REFERENCES users(id),
  analysis_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  situation          TEXT,
  description        TEXT,
  savings_identified NUMERIC(14,2),
  recommendations    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disputes (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL REFERENCES tenants(id),
  company_id       INT REFERENCES companies(id),
  person_id        INT REFERENCES persons(id),
  operator_id      INT REFERENCES operators(id),
  invoice_id       INT REFERENCES invoices(id),
  protocol_number  TEXT,
  contested_amount NUMERIC(14,2),
  dispute_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('aberta','em_andamento','finalizada')),
  result           TEXT CHECK (result IN ('aprovada','negada','parcial')),
  recovered_amount NUMERIC(14,2),
  responsible_id   INT REFERENCES users(id),
  closed_at        DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_adjustments (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  company_id      INT REFERENCES companies(id),
  person_id       INT REFERENCES persons(id),
  line_id         INT REFERENCES phone_lines(id),
  old_plan        TEXT,
  new_plan        TEXT,
  old_value       NUMERIC(14,2),
  new_value       NUMERIC(14,2),
  monthly_savings NUMERIC(14,2),
  annual_savings  NUMERIC(14,2),
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responsible_id  INT REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN ('proposta','aprovada','implantada','cancelada')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------- Contratos e Financeiro -------------------

CREATE TABLE IF NOT EXISTS contracts (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  type          TEXT NOT NULL DEFAULT 'consultoria',
  company_id    INT REFERENCES companies(id),
  person_id     INT REFERENCES persons(id),
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date    DATE,
  end_date      DATE,
  months        INT,
  value         NUMERIC(14,2),
  renewal_type  TEXT NOT NULL DEFAULT 'manual' CHECK (renewal_type IN ('automatica','manual')),
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','cancelado')),
  document_id   INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenues (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id),
  company_id  INT REFERENCES companies(id),
  person_id   INT REFERENCES persons(id),
  contract_id INT REFERENCES contracts(id),
  description TEXT,
  amount      NUMERIC(14,2) NOT NULL,
  due_date    DATE,
  paid_at     DATE,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','atrasada','cancelada')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commissions (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id),
  consultant_id   INT NOT NULL REFERENCES users(id),
  revenue_id      INT REFERENCES revenues(id),
  reference_month TEXT, -- AAAA-MM
  base_amount     NUMERIC(14,2),
  percent         NUMERIC(6,2),
  amount          NUMERIC(14,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga')),
  paid_at         DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------- Documentos -------------------

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  entity        TEXT,     -- companies, persons, invoices, contracts, disputes...
  entity_id     INT,
  category      TEXT NOT NULL DEFAULT 'outro' CHECK (category IN ('contrato','procuracao','fatura','relatorio','print','comprovante','outro')),
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime          TEXT,
  size          BIGINT,
  uploaded_by   INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------- Auditoria e Notificações -------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  user_id    INT,
  user_name  TEXT,
  entity     TEXT NOT NULL,
  entity_id  INT,
  action     TEXT NOT NULL, -- create, update, delete, login, export...
  changes    JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id),
  user_id    INT REFERENCES users(id),
  type       TEXT NOT NULL, -- follow_up, vencimento, contestacao, contrato, tarefa, sistema
  title      TEXT NOT NULL,
  message    TEXT,
  entity     TEXT,
  entity_id  INT,
  dedup_key  TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup ON notifications (tenant_id, dedup_key) WHERE dedup_key IS NOT NULL;

-- ------------------- Índices -------------------

CREATE INDEX IF NOT EXISTS idx_users_tenant       ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant   ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj     ON companies(tenant_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_persons_tenant     ON persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_cpf        ON persons(tenant_id, cpf);
CREATE INDEX IF NOT EXISTS idx_leads_tenant       ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(tenant_id, status_id);
CREATE INDEX IF NOT EXISTS idx_agenda_tenant      ON agenda_events(tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant       ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_lines_tenant       ON phone_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lines_number       ON phone_lines(tenant_id, number);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant    ON invoices(tenant_id, competence);
CREATE INDEX IF NOT EXISTS idx_disputes_tenant    ON disputes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant   ON contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_revenues_tenant    ON revenues(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_log(tenant_id, entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(tenant_id, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_comments_entity    ON comments(tenant_id, entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity   ON documents(tenant_id, entity, entity_id);
