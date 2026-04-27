# Portal de Orçamentos — API Reference

Base URL: `http://localhost:3000`

Autenticação: `Authorization: Bearer <accessToken>`

---

## Auth

### POST /auth/login
Login do usuário.

**Body:**
```json
{ "email": "admin@portal.local", "password": "Admin@123456" }
```
**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid", "name": "Nome", "email": "email",
    "role": "ADMIN|ANALYST|CLIENT",
    "clientIds": ["uuid"],
    "defaultClientId": "uuid",
    "clients": [{ "id": "uuid", "name": "Cliente", "isDefault": true }]
  }
}
```

### POST /auth/refresh
Renova o access token.

**Body:** `{ "refreshToken": "eyJ..." }`
**Response 200:** `{ "accessToken": "...", "refreshToken": "..." }`

### GET /auth/me
Retorna o usuário autenticado.

### POST /auth/logout
Registra logout na auditoria.

### POST /auth/forgot-password
Solicita reset de senha.

**Body:** `{ "email": "usuario@email.com" }`
**Response 200:** `{ "message": "...", "devToken": "..." }` *(devToken apenas em NODE_ENV != production)*

### POST /auth/reset-password
Redefine a senha com o token recebido.

**Body:** `{ "token": "hex64chars", "password": "novaSenha123" }`

---

## Usuários — /api/v1/users

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /users | ADMIN | Listar com filtros |
| GET    | /users/:id | AUTH | Ver detalhes (próprio ou admin) |
| POST   | /users | ADMIN | Criar usuário |
| PATCH  | /users/:id | AUTH | Atualizar (próprio ou admin) |
| DELETE | /users/:id | ADMIN | Desativar (soft delete) |
| POST   | /users/:id/clients | ADMIN | Vincular cliente |
| DELETE | /users/:id/clients/:clientId | ADMIN | Desvincular cliente |

**Query params GET /users:** `page, limit, role, status, q`

---

## Clientes — /api/v1/clients

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /clients | ANALYST, ADMIN | Listar |
| GET    | /clients/:id | ANALYST, ADMIN | Detalhes + usuários + tabelas |
| POST   | /clients | ADMIN | Criar |
| PATCH  | /clients/:id | ADMIN | Atualizar |
| DELETE | /clients/:id | ADMIN | Desativar |

---

## Tipos de Serviço — /api/v1/service-types

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /service-types | AUTH | Listar ativos |
| POST   | /service-types | ADMIN | Criar |
| PATCH  | /service-types/:id | ADMIN | Atualizar/ativar/desativar |
| DELETE | /service-types/:id | ADMIN | Desativar |

**Query:** `includeInactive=true`

---

## Tabela de Preços — /api/v1/clients/:clientId/price-tables

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /price-tables | ANALYST, ADMIN | Listar tabelas do cliente |
| GET    | /price-tables/:tableId | ANALYST, ADMIN | Detalhes + itens |
| POST   | /price-tables | ADMIN | Criar tabela |
| PATCH  | /price-tables/:tableId | ADMIN | Atualizar tabela |
| DELETE | /price-tables/:tableId | ADMIN | Arquivar tabela |
| POST   | /price-tables/:tableId/clone | ADMIN | Clonar tabela |
| POST   | /price-tables/:tableId/items | ADMIN | Criar item |
| PATCH  | /price-tables/:tableId/items/:itemId | ADMIN | Atualizar item |
| DELETE | /price-tables/:tableId/items/:itemId | ADMIN | Desativar item |

**Query GET itens:** `q, serviceTypeId, includeInactive`

**Body POST item:**
```json
{
  "code": "ATV-001",
  "description": "Ativação de serviço VSAT",
  "unit": "un",
  "unitValue": 350.00,
  "serviceTypeId": "uuid",
  "notes": "Inclui configuração",
  "sortOrder": 1
}
```

---

## Solicitações — /api/v1/requests

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /requests | AUTH | Fila com filtros |
| GET    | /requests/:id | AUTH | Detalhes + histórico |
| POST   | /requests | AUTH | Abrir solicitação |
| PATCH  | /requests/:id | AUTH | Atualizar dados |
| POST   | /requests/:id/status | AUTH | Transição de status |
| POST   | /requests/:id/assign | ANALYST, ADMIN | Assumir/atribuir |
| GET    | /requests/:id/history | AUTH | Histórico de ações |

**Query GET /requests:** `page, limit, status, clientId, isUrgent, serviceTypeId, assignedTo, q, from, to, sort, order`

**Body POST /requests:**
```json
{
  "clientId": "uuid",
  "requesterName": "Nome",
  "requesterEmail": "email@email.com",
  "requesterPhone": "(11) 99999-9999",
  "finalClientName": "João Silva",
  "finalClientCompany": "Fazenda X",
  "finalClientDocument": "123.456.789-00",
  "finalClientContact": "Gerente local",
  "finalClientPhone": "(11) 88888-8888",
  "zipCode": "01310-100",
  "street": "Av. Paulista",
  "streetNumber": "1000",
  "complement": "Sala 10",
  "neighborhood": "Bela Vista",
  "city": "São Paulo",
  "state": "SP",
  "reference": "Próximo ao metrô",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "serviceTypeIds": ["uuid1", "uuid2"],
  "description": "Descrição detalhada...",
  "observations": "Observações...",
  "requestedDate": "2024-12-31",
  "isUrgent": false
}
```

**Body POST /requests/:id/status:**
```json
{
  "status": "IN_ANALYSIS",
  "observations": "Motivo (obrigatório para REJECTED, ON_HOLD, CANCELLED)",
  "estimatedDate": "2024-12-31"
}
```

**Transições válidas:**
```
REQUESTED → IN_ANALYSIS, CANCELLED
IN_ANALYSIS → QUOTE_IN_PROGRESS, CANCELLED
QUOTE_IN_PROGRESS → QUOTE_SENT, IN_ANALYSIS
QUOTE_SENT → APPROVED, REJECTED*, ON_HOLD*, CANCELLED*
ON_HOLD → QUOTE_SENT, CANCELLED*
* Observação obrigatória
```

---

## Orçamentos — /api/v1/requests/:requestId/quotes

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /quotes | AUTH | Listar orçamentos da solicitação |
| GET    | /quotes/:quoteId | AUTH | Detalhes + itens |
| POST   | /quotes | ANALYST, ADMIN | Criar orçamento |
| PATCH  | /quotes/:quoteId | ANALYST, ADMIN | Atualizar cabeçalho/notas |
| POST   | /quotes/:quoteId/items | ANALYST, ADMIN | Adicionar item |
| PATCH  | /quotes/:quoteId/items/:itemId | ANALYST, ADMIN | Editar item |
| DELETE | /quotes/:quoteId/items/:itemId | ANALYST, ADMIN | Remover item |
| POST   | /quotes/:quoteId/send | ANALYST, ADMIN | Enviar ao cliente |
| POST   | /quotes/:quoteId/decision | AUTH | Decisão do cliente |
| GET    | /quotes/:quoteId/history | AUTH | Histórico do orçamento |

**Body POST item (da tabela):**
```json
{
  "priceItemId": "uuid",
  "serviceTypeId": "uuid",
  "origin": "TABLE",
  "code": "ATV-001",
  "description": "Ativação de serviço VSAT",
  "unit": "un",
  "quantity": 1,
  "unitValue": 350.00
}
```

**Body POST item (manual):**
```json
{
  "origin": "MANUAL",
  "description": "Serviço adicional não catalogado",
  "unit": "h",
  "quantity": 3,
  "unitValue": 120.00
}
```

**Body PATCH /quotes/:quoteId:**
```json
{
  "technicalNotes": "Observações técnicas...",
  "commercialNotes": "Validade: 30 dias.",
  "discount": 50.00,
  "estimatedDate": "2024-12-31"
}
```

**Body POST /decision:**
```json
{
  "status": "APPROVED|REJECTED|ON_HOLD|CANCELLED",
  "decisionReason": "Motivo (obrigatório para REJECTED, ON_HOLD, CANCELLED)"
}
```

---

## Dashboard — /api/v1/dashboard

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | /dashboard/client | AUTH | Dashboard do cliente |
| GET    | /dashboard/operational | ANALYST, ADMIN | Dashboard operacional |
| GET    | /dashboard/queue-stats | ANALYST, ADMIN | Contadores de fila (real-time) |

**Query params:** `from (YYYY-MM-DD), to (YYYY-MM-DD), clientId`

**Response /dashboard/client:**
```json
{
  "summary": {
    "total": 42,
    "urgent": 3,
    "byStatus": { "REQUESTED": 5, "APPROVED": 12, ... }
  },
  "byServiceType": [
    { "serviceTypeId": "uuid", "serviceTypeName": "Ativação", "count": 15 }
  ],
  "byMonth": [{ "month": "2024-12", "count": 8 }]
}
```

**Response /dashboard/operational** (adiciona):
```json
{
  "quotes": {
    "total": 38,
    "totalValue": 95000.00,
    "approved": 20,
    "approvedValue": 52000.00
  },
  "byAnalyst": [{ "analystId": "uuid", "analystName": "Nome", "count": 10 }],
  "byClient":  [{ "clientId": "uuid", "clientName": "Empresa", "count": 15 }]
}
```

---

## Respostas de erro padrão

```json
{
  "error": {
    "code": "VALIDATION_ERROR|NOT_FOUND|FORBIDDEN|UNAUTHORIZED|CONFLICT|INVALID_STATUS_TRANSITION|RATE_LIMIT",
    "message": "Descrição legível do erro",
    "details": { "campo": "mensagem de validação" }
  }
}
```

| HTTP | Code | Situação |
|------|------|----------|
| 400  | VALIDATION_ERROR | Dados inválidos no body |
| 401  | UNAUTHORIZED | Token ausente, inválido ou expirado |
| 403  | FORBIDDEN | Perfil sem permissão para a operação |
| 404  | *_NOT_FOUND | Recurso não encontrado |
| 409  | CONFLICT | Registro duplicado (e-mail, documento) |
| 422  | INVALID_STATUS_TRANSITION | Transição de status não permitida |
| 429  | RATE_LIMIT | Muitas requisições |
| 500  | INTERNAL_ERROR | Erro interno do servidor |
