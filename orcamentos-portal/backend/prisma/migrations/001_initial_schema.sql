-- ============================================================
-- Portal de Orçamentos — Migration 001
-- Criação completa do schema
-- ============================================================

-- ENUMS
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ANALYST', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "RequestStatus" AS ENUM (
  'REQUESTED',
  'IN_ANALYSIS',
  'QUOTE_IN_PROGRESS',
  'QUOTE_SENT',
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'CANCELLED'
);
CREATE TYPE "QuoteStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'CANCELLED'
);
CREATE TYPE "QuoteItemOrigin" AS ENUM ('TABLE', 'MANUAL');
CREATE TYPE "ServiceTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PriceTableStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "PriceItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'VALUE_EDIT',
  'SEND',
  'APPROVE',
  'REJECT',
  'CANCEL'
);

-- ============================================================
-- USUÁRIOS
-- ============================================================
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           "UserRole" NOT NULL,
  status         "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  last_login_at  TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMP
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_status   ON users(status);

-- ============================================================
-- CLIENTES (EMPRESAS/CONTAS)
-- ============================================================
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  trade_name  VARCHAR(255),
  document    VARCHAR(18),
  email       VARCHAR(255),
  phone       VARCHAR(20),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMP
);

CREATE INDEX idx_clients_active ON clients(is_active) WHERE deleted_at IS NULL;

-- Relação N:N usuário ↔ cliente
CREATE TABLE client_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  client_id   UUID NOT NULL REFERENCES clients(id),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_client_users_user   ON client_users(user_id);
CREATE INDEX idx_client_users_client ON client_users(client_id);

-- ============================================================
-- TIPOS DE SERVIÇO
-- ============================================================
CREATE TABLE service_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  status      "ServiceTypeStatus" NOT NULL DEFAULT 'ACTIVE',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA DE PREÇOS (por cliente)
-- ============================================================
CREATE TABLE price_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      "PriceTableStatus" NOT NULL DEFAULT 'ACTIVE',
  version     INTEGER NOT NULL DEFAULT 1,
  valid_from  TIMESTAMP,
  valid_until TIMESTAMP,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMP
);

CREATE INDEX idx_price_tables_client ON price_tables(client_id);
CREATE INDEX idx_price_tables_status ON price_tables(client_id, status) WHERE deleted_at IS NULL;

CREATE TABLE price_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id  UUID NOT NULL REFERENCES price_tables(id),
  service_type_id UUID REFERENCES service_types(id),
  code            VARCHAR(50) NOT NULL,
  description     VARCHAR(500) NOT NULL,
  unit            VARCHAR(30) NOT NULL,
  unit_value      DECIMAL(12, 2) NOT NULL,
  notes           TEXT,
  status          "PriceItemStatus" NOT NULL DEFAULT 'ACTIVE',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_items_table        ON price_items(price_table_id);
CREATE INDEX idx_price_items_service_type ON price_items(price_table_id, service_type_id);
CREATE INDEX idx_price_items_status       ON price_items(price_table_id, status);

-- ============================================================
-- SOLICITAÇÕES
-- ============================================================
CREATE TABLE requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number        VARCHAR(20) NOT NULL UNIQUE,
  status                "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
  is_urgent             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Quem solicitou
  created_by            UUID NOT NULL REFERENCES users(id),
  client_id             UUID NOT NULL REFERENCES clients(id),

  -- Dados do solicitante
  requester_name        VARCHAR(255) NOT NULL,
  requester_email       VARCHAR(255) NOT NULL,
  requester_phone       VARCHAR(20),

  -- Dados do cliente final
  final_client_name     VARCHAR(255) NOT NULL,
  final_client_company  VARCHAR(255),
  final_client_document VARCHAR(18),
  final_client_contact  VARCHAR(255),
  final_client_phone    VARCHAR(20),

  -- Endereço
  zip_code              VARCHAR(10),
  street                VARCHAR(255),
  street_number         VARCHAR(20),
  complement            VARCHAR(100),
  neighborhood          VARCHAR(100),
  city                  VARCHAR(100),
  state                 CHAR(2),
  reference             TEXT,
  latitude              DECIMAL(10, 7),
  longitude             DECIMAL(10, 7),

  -- Dados do serviço
  description           TEXT,
  observations          TEXT,
  requested_date        DATE,
  estimated_date        DATE,

  -- Analista
  assigned_to           UUID REFERENCES users(id),

  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP
);

CREATE INDEX idx_requests_client     ON requests(client_id);
CREATE INDEX idx_requests_status     ON requests(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_urgent     ON requests(is_urgent, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_assigned   ON requests(assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);

-- Tipos de serviço da solicitação (N:N)
CREATE TABLE request_service_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES requests(id),
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, service_type_id)
);

CREATE INDEX idx_rst_request      ON request_service_types(request_id);
CREATE INDEX idx_rst_service_type ON request_service_types(service_type_id);

-- Histórico da solicitação
CREATE TABLE request_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID NOT NULL REFERENCES requests(id),
  performed_by   UUID NOT NULL REFERENCES users(id),
  action         VARCHAR(100) NOT NULL,
  from_status    "RequestStatus",
  to_status      "RequestStatus",
  observations   TEXT,
  performed_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_request_history_request ON request_history(request_id);
CREATE INDEX idx_request_history_date    ON request_history(performed_at DESC);

-- ============================================================
-- ORÇAMENTOS
-- ============================================================
CREATE TABLE quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES requests(id),
  status            "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  created_by        UUID NOT NULL REFERENCES users(id),

  subtotal          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_value       DECIMAL(12, 2) NOT NULL DEFAULT 0,

  technical_notes   TEXT,
  commercial_notes  TEXT,
  decision_reason   TEXT,

  sent_at           TIMESTAMP,
  decided_at        TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP
);

CREATE INDEX idx_quotes_request ON quotes(request_id);
CREATE INDEX idx_quotes_status  ON quotes(status) WHERE deleted_at IS NULL;

-- Itens do orçamento
CREATE TABLE quote_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id              UUID NOT NULL REFERENCES quotes(id),
  service_type_id       UUID REFERENCES service_types(id),
  origin                "QuoteItemOrigin" NOT NULL DEFAULT 'TABLE',
  price_item_id         UUID,  -- referência soft — sem FK para permitir deleção de itens da tabela
  code                  VARCHAR(50),
  description           VARCHAR(500) NOT NULL,
  unit                  VARCHAR(30) NOT NULL,
  quantity              DECIMAL(10, 3) NOT NULL,
  unit_value            DECIMAL(12, 2) NOT NULL,
  total_value           DECIMAL(12, 2) NOT NULL,
  original_unit_value   DECIMAL(12, 2),
  was_manually_edited   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- Histórico do orçamento
CREATE TABLE quote_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES quotes(id),
  performed_by  UUID NOT NULL REFERENCES users(id),
  action        "AuditAction" NOT NULL,
  from_status   "QuoteStatus",
  to_status     "QuoteStatus",
  observations  TEXT,
  metadata      JSONB,
  performed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_history_quote ON quote_history(quote_id);
CREATE INDEX idx_quote_history_date  ON quote_history(performed_at DESC);

-- ============================================================
-- AUDITORIA GERAL
-- ============================================================
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  action       "AuditAction" NOT NULL,
  entity_type  VARCHAR(100) NOT NULL,
  entity_id    UUID NOT NULL,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  performed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user    ON audit_logs(user_id, performed_at DESC);
CREATE INDEX idx_audit_date    ON audit_logs(performed_at DESC);

-- ============================================================
-- FUNÇÃO: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at       BEFORE UPDATE ON clients       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_service_types_updated_at BEFORE UPDATE ON service_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_price_tables_updated_at  BEFORE UPDATE ON price_tables  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_price_items_updated_at   BEFORE UPDATE ON price_items   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_requests_updated_at      BEFORE UPDATE ON requests      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_quotes_updated_at        BEFORE UPDATE ON quotes        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_quote_items_updated_at   BEFORE UPDATE ON quote_items   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FUNÇÃO: geração de número sequencial de solicitação
-- Formato: ORC-2024-000001
-- ============================================================
CREATE SEQUENCE request_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'ORC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('request_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requests_number
  BEFORE INSERT ON requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION generate_request_number();
