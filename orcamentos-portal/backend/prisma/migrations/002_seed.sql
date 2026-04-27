-- ============================================================
-- Portal de Orçamentos — Seed 001
-- Dados iniciais para desenvolvimento e produção
-- ============================================================

-- ============================================================
-- USUÁRIOS INICIAIS
-- Senha padrão para todos: Admin@123456
-- Hash bcrypt (rounds=12): $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfBbNGdGJhHJDCN7e
-- IMPORTANTE: trocar todas as senhas no primeiro acesso
-- ============================================================

INSERT INTO users (id, name, email, password_hash, role, status) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Administrador do Sistema',
  'admin@portal.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfBbNGdGJhHJDCN7e',
  'ADMIN',
  'ACTIVE'
),
(
  '00000000-0000-0000-0000-000000000002',
  'Analista Padrão',
  'analista@portal.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfBbNGdGJhHJDCN7e',
  'ANALYST',
  'ACTIVE'
),
(
  '00000000-0000-0000-0000-000000000003',
  'Cliente Demo',
  'cliente@demo.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfBbNGdGJhHJDCN7e',
  'CLIENT',
  'ACTIVE'
);

-- ============================================================
-- CLIENTE DEMO
-- ============================================================
INSERT INTO clients (id, name, trade_name, document, email, phone, is_active) VALUES
(
  '00000000-0000-0000-0000-000000000010',
  'Empresa Demo Ltda',
  'Demo',
  '00.000.000/0001-00',
  'contato@demo.local',
  '(11) 99999-0000',
  TRUE
);

-- Vínculo: usuário cliente → empresa demo
INSERT INTO client_users (user_id, client_id, is_default) VALUES
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000010',
  TRUE
);

-- ============================================================
-- TIPOS DE SERVIÇO (conforme especificação)
-- ============================================================
INSERT INTO service_types (id, name, description, status, sort_order) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  'Ativação',
  'Ativação de novo serviço ou equipamento',
  'ACTIVE', 1
),
(
  '00000000-0000-0000-0001-000000000002',
  'Mudança de Endereço',
  'Transferência de serviço para novo endereço',
  'ACTIVE', 2
),
(
  '00000000-0000-0000-0001-000000000003',
  'Mudança de Layout',
  'Alteração no layout ou configuração do serviço',
  'ACTIVE', 3
),
(
  '00000000-0000-0000-0001-000000000004',
  'Migração',
  'Migração de tecnologia ou plano',
  'ACTIVE', 4
),
(
  '00000000-0000-0000-0001-000000000005',
  'Vistoria',
  'Visita técnica para avaliação do local',
  'ACTIVE', 5
),
(
  '00000000-0000-0000-0001-000000000006',
  'Obra Civil',
  'Serviços de infraestrutura e obra civil',
  'ACTIVE', 6
),
(
  '00000000-0000-0000-0001-000000000007',
  'Outros',
  'Demais serviços não categorizados',
  'ACTIVE', 7
);

-- ============================================================
-- TABELA DE PREÇOS DEMO (para cliente demo)
-- Itens de exemplo para facilitar o desenvolvimento
-- ============================================================
INSERT INTO price_tables (
  id, client_id, name, description, status, version, created_by
) VALUES (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Tabela de Preços Padrão 2024',
  'Tabela de preços vigente para serviços gerais',
  'ACTIVE',
  1,
  '00000000-0000-0000-0000-000000000001'
);

-- Itens da tabela de preços demo
INSERT INTO price_items (
  price_table_id, service_type_id, code, description, unit, unit_value, status, sort_order, created_by
) VALUES
-- Ativação
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'ATV-001', 'Ativação de serviço VSAT', 'un', 350.00, 'ACTIVE', 1,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'ATV-002', 'Ativação de serviço Starlink', 'un', 280.00, 'ACTIVE', 2,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'ATV-003', 'Configuração de roteador', 'un', 120.00, 'ACTIVE', 3,
  '00000000-0000-0000-0000-000000000001'
),
-- Vistoria
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000005',
  'VST-001', 'Vistoria técnica local', 'un', 200.00, 'ACTIVE', 10,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000005',
  'VST-002', 'Relatório técnico de vistoria', 'un', 80.00, 'ACTIVE', 11,
  '00000000-0000-0000-0000-000000000001'
),
-- Obra Civil
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000006',
  'OBR-001', 'Passagem de cabeamento externo', 'm', 15.00, 'ACTIVE', 20,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000006',
  'OBR-002', 'Fixação de suporte de antena', 'un', 180.00, 'ACTIVE', 21,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000006',
  'OBR-003', 'Passagem de eletroduto', 'm', 22.00, 'ACTIVE', 22,
  '00000000-0000-0000-0000-000000000001'
),
-- Migração
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000004',
  'MIG-001', 'Migração de tecnologia VSAT para Starlink', 'un', 450.00, 'ACTIVE', 30,
  '00000000-0000-0000-0000-000000000001'
),
-- Mudança de Endereço
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000002',
  'MDE-001', 'Desativação e reinstalação em novo endereço', 'un', 500.00, 'ACTIVE', 40,
  '00000000-0000-0000-0000-000000000001'
),
-- Geral / Outros
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000007',
  'GER-001', 'Hora técnica adicional', 'h', 120.00, 'ACTIVE', 50,
  '00000000-0000-0000-0000-000000000001'
),
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000007',
  'GER-002', 'Deslocamento extra (por km)', 'km', 3.50, 'ACTIVE', 51,
  '00000000-0000-0000-0000-000000000001'
);

-- ============================================================
-- SOLICITAÇÃO DEMO (para testar o fluxo completo)
-- ============================================================
INSERT INTO requests (
  id,
  request_number,
  status,
  is_urgent,
  created_by,
  client_id,
  requester_name,
  requester_email,
  requester_phone,
  final_client_name,
  final_client_company,
  city,
  state,
  description,
  requested_date,
  assigned_to
) VALUES (
  '00000000-0000-0000-0003-000000000001',
  'ORC-2024-000001',
  'IN_ANALYSIS',
  TRUE,
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000010',
  'Cliente Demo',
  'cliente@demo.local',
  '(11) 99999-0000',
  'João da Silva',
  'Fazenda São José',
  'Campinas',
  'SP',
  'Necessidade de ativação de link Starlink e obra civil para passagem de cabo até o escritório central.',
  '2024-12-31',
  '00000000-0000-0000-0000-000000000002'
);

-- Tipos de serviço da solicitação demo
INSERT INTO request_service_types (request_id, service_type_id) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0001-000000000001'  -- Ativação
),
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0001-000000000006'  -- Obra Civil
);

-- Histórico da solicitação demo
INSERT INTO request_history (request_id, performed_by, action, from_status, to_status, observations) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Solicitação criada pelo cliente',
  NULL,
  'REQUESTED',
  NULL
),
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Analista assumiu a solicitação',
  'REQUESTED',
  'IN_ANALYSIS',
  'Iniciando análise do projeto.'
);
