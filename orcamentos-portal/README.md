# Portal de Orçamentos

Sistema enterprise de gestão de solicitações e orçamentos de serviços, com portal para clientes, fila operacional para analistas e painel administrativo completo.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + TanStack Query v5 |
| Backend | Node.js 20 + Fastify + TypeScript + Zod + Prisma |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 |
| Infra | Docker Compose + Nginx |

## Estrutura

```
orcamentos-portal/
├── backend/
│   ├── src/
│   │   ├── modules/        # auth, users, clients, requests, quotes, price-tables, service-types, dashboard
│   │   ├── shared/         # middleware, errors, utils, types
│   │   └── infrastructure/ # database (Prisma)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       └── 002_seed.sql
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # ui.tsx — componentes compartilhados
│   │   ├── hooks/          # queries.ts — TanStack Query hooks
│   │   ├── layouts/        # AppLayout (sidebar adaptativa por role)
│   │   ├── lib/            # api.ts, constants.ts
│   │   ├── pages/          # Login, Dashboard, Requests, Quotes, PriceTables, Users
│   │   └── store/          # auth.store.ts (Zustand)
│   └── Dockerfile
├── nginx/
│   ├── nginx.local.conf
│   ├── nginx.prod.conf
│   └── nginx.conf
└── docker-compose.yml
```

## Setup rápido (desenvolvimento)

### 1. Pré-requisitos
- Node.js 20+
- PostgreSQL 16
- Redis 7

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edite .env com suas credenciais

npm install

# Rodar migrations e seed
psql -U seu_usuario -d orcamentos_db -f prisma/migrations/001_initial_schema.sql
psql -U seu_usuario -d orcamentos_db -f prisma/migrations/002_seed.sql

# Gerar Prisma Client
npx prisma generate

# Iniciar
npm run dev  # ou: tsx src/server.ts
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:5173

## Deploy com Docker

```bash
# Copiar e configurar variáveis
cp .env.example .env
# Edite: POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, NGINX_CONF

# Subir tudo
docker compose up -d

# Verificar saúde
docker compose ps
curl http://localhost/health
```

### Produção (HTTPS)

```bash
# 1) Configure o .env com NGINX_CONF=nginx.prod.conf
# 2) Monte certificados em ./nginx/ssl:
#    - fullchain.pem
#    - privkey.pem

docker compose up -d --build
```

### Desenvolvimento com portas de debug

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Credenciais de acesso (seed)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | admin@portal.local | Admin@123456 |
| Analista | analista@portal.local | Admin@123456 |
| Cliente | cliente@demo.local | Admin@123456 |

> ⚠️ Troque todas as senhas no primeiro acesso em produção.

## Perfis e permissões

| Funcionalidade | Cliente | Analista | Admin |
|----------------|---------|----------|-------|
| Abrir solicitação | ✅ | ✅ | ✅ |
| Ver solicitações | Próprias | Todas | Todas |
| Montar orçamento | ❌ | ✅ | ✅ |
| Aprovar/reprovar | ✅ | ❌ | ❌ |
| Tabela de preços | ❌ | Ver | CRUD |
| Usuários | ❌ | ❌ | CRUD |
| Dashboard global | ❌ | ✅ | ✅ |

## Endpoints principais

```
POST   /auth/login
POST   /auth/refresh
GET    /auth/me
POST   /auth/logout

GET    /api/v1/requests
POST   /api/v1/requests
GET    /api/v1/requests/:id
POST   /api/v1/requests/:id/status
POST   /api/v1/requests/:id/assign

GET    /api/v1/requests/:requestId/quotes
POST   /api/v1/requests/:requestId/quotes
POST   /api/v1/requests/:requestId/quotes/:quoteId/send
POST   /api/v1/requests/:requestId/quotes/:quoteId/decision
POST   /api/v1/requests/:requestId/quotes/:quoteId/items

GET    /api/v1/clients/:clientId/price-tables
POST   /api/v1/clients/:clientId/price-tables
POST   /api/v1/clients/:clientId/price-tables/:tableId/items
POST   /api/v1/clients/:clientId/price-tables/:tableId/clone

GET    /api/v1/dashboard/client
GET    /api/v1/dashboard/operational
GET    /api/v1/dashboard/queue-stats

GET    /health
```

## Fluxo de status

```
REQUESTED → IN_ANALYSIS → QUOTE_IN_PROGRESS → QUOTE_SENT
                                                    ↓
                                         APPROVED / REJECTED / ON_HOLD / CANCELLED
```

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_SECRET` | Segredo JWT (mín. 32 chars) |
| `NODE_ENV` | Ambiente do backend (production/development/test) |
| `POSTGRES_USER` | Usuário do banco (Docker) |
| `POSTGRES_PASSWORD` | Senha do banco (Docker) |
| `POSTGRES_DB` | Nome do banco (Docker) |
| `CORS_ORIGIN` | URL do frontend |
| `REDIS_URL` | Connection string Redis |
| `VITE_API_URL` | URL da API no build do frontend (opcional) |
