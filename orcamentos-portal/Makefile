# ============================================================
# Portal de Orçamentos — Makefile
# Comandos de operação e desenvolvimento
# ============================================================

.PHONY: up down restart logs ps health setup-dev db-setup db-reset

# ── Docker ────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=100

logs-backend:
	docker compose logs -f backend --tail=100

ps:
	docker compose ps

health:
	@curl -s http://localhost/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost/health

# ── Setup ─────────────────────────────────────────────────
setup:
	@echo "Copiando .env.example para .env..."
	@test -f .env || cp .env.example .env
	@echo "⚠️  Edite o arquivo .env com suas configurações antes de continuar."
	@echo "Depois execute: make up"

build:
	docker compose build --no-cache

# ── Banco de dados ────────────────────────────────────────
db-shell:
	docker compose exec postgres psql -U orcamentos_user -d orcamentos_db

db-reset:
	@echo "⚠️  ATENÇÃO: Isso apagará todos os dados!"
	@read -p "Confirmar? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker compose exec postgres psql -U orcamentos_user -d orcamentos_db \
		-c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker compose exec postgres psql -U orcamentos_user -d orcamentos_db \
		-f /docker-entrypoint-initdb.d/001_schema.sql
	docker compose exec postgres psql -U orcamentos_user -d orcamentos_db \
		-f /docker-entrypoint-initdb.d/002_seed.sql

# ── Dev local ─────────────────────────────────────────────
dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

dev-install:
	cd backend  && npm install
	cd frontend && npm install

# ── Prisma ────────────────────────────────────────────────
prisma-generate:
	cd backend && npx prisma generate

prisma-studio:
	cd backend && npx prisma studio
