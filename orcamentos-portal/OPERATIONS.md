# Portal de Orçamentos — Guia de Operação

## 1. Pré-requisitos

| Componente | Versão mínima |
|------------|--------------|
| Docker     | 24+          |
| Docker Compose | 2.20+    |
| Node.js (dev local) | 20+ |
| PostgreSQL (dev local) | 16+ |
| Redis (dev local) | 7+ |

---

## 2. Deploy em produção (Docker Compose)

### Passo 1 — Clonar e configurar

```bash
git clone <repositório>
cd orcamentos-portal
cp .env.example .env
```

Editar `.env` com valores reais:

```env
POSTGRES_PASSWORD=senha_forte_aqui_min_20_chars
JWT_SECRET=gere_com_openssl_rand_hex_32
CORS_ORIGIN=https://seu-dominio.com
VITE_API_URL=https://seu-dominio.com
```

Gerar JWT_SECRET seguro:
```bash
openssl rand -hex 32
```

### Passo 2 — Build e subida

```bash
make build   # build das imagens Docker
make up      # sobe todos os serviços em background
```

### Passo 3 — Verificar saúde

```bash
make health          # verifica o endpoint /health
make ps              # lista containers e status
docker compose logs  # logs de todos os serviços
```

Resposta esperada do /health:
```json
{
  "status": "healthy",
  "checks": { "database": "ok", "redis": "ok" }
}
```

### Passo 4 — Primeiro acesso

Acessar `http://seu-dominio` e fazer login com as credenciais do seed:

| Perfil | E-mail | Senha padrão |
|--------|--------|-------------|
| Admin | admin@portal.local | Admin@123456 |
| Analista | analista@portal.local | Admin@123456 |
| Cliente | cliente@demo.local | Admin@123456 |

> ⚠️ **Obrigatório:** alterar todas as senhas no primeiro acesso via Perfil ou painel de Usuários.

---

## 3. Operação diária

### Logs em tempo real

```bash
make logs                      # todos os serviços
make logs-backend              # apenas backend
docker compose logs -f nginx   # apenas nginx
```

### Reiniciar serviço específico

```bash
docker compose restart backend
docker compose restart frontend
```

### Ver uso de recursos

```bash
docker stats
```

---

## 4. Banco de dados

### Acesso ao shell PostgreSQL

```bash
make db-shell
# Equivalente a:
docker compose exec postgres psql -U orcamentos_user -d orcamentos_db
```

### Queries úteis de diagnóstico

```sql
-- Solicitações por status
SELECT status, COUNT(*) FROM requests WHERE deleted_at IS NULL GROUP BY status;

-- Orçamentos dos últimos 30 dias
SELECT COUNT(*), SUM(total_value)
FROM quotes
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL;

-- Usuários ativos
SELECT role, COUNT(*) FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL GROUP BY role;

-- Últimas ações de auditoria
SELECT entity_type, action, performed_at
FROM audit_logs
ORDER BY performed_at DESC
LIMIT 20;
```

### Backup manual

```bash
docker compose exec postgres pg_dump \
  -U orcamentos_user orcamentos_db \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore

```bash
docker compose exec -T postgres psql \
  -U orcamentos_user orcamentos_db \
  < backup-YYYYMMDD-HHMMSS.sql
```

### Reset completo (⚠️ apaga todos os dados)

```bash
make db-reset   # pede confirmação interativa
```

---

## 5. Administração do sistema

### Criar novo analista

1. Acessar menu **Usuários**
2. Clicar em **Novo usuário**
3. Preencher nome, e-mail, senha temporária
4. Selecionar perfil **Analista**
5. Entregar credenciais ao analista e solicitar troca de senha

### Criar novo cliente

1. Acessar menu **Clientes → Novo cliente**
2. Preencher razão social, CNPJ, e-mail
3. Acessar menu **Usuários → Novo usuário**
4. Criar usuário com perfil **Cliente**
5. Acessar o usuário criado e vincular ao cliente
6. Definir o cliente como padrão se for o único

### Configurar tabela de preços para novo cliente

1. Acessar **Tabela de Preços**
2. Selecionar o cliente
3. Clicar em **Nova tabela**
4. Preencher nome (ex: "Tabela Padrão 2024")
5. Adicionar itens com código, descrição, unidade e valor
6. A tabela fica com status **Ativo** automaticamente

### Clonar tabela de preços (nova versão)

1. Acessar a tabela existente
2. Clicar no ícone **Clonar** (📋)
3. A nova tabela é criada com status **Inativo**
4. Editar os itens necessários
5. Ativar a nova tabela e arquivar a antiga

### Gerenciar tipos de serviço

1. Acessar **Tipos de Serviço** (menu Admin)
2. Criar, editar ou ativar/desativar tipos
3. Ajustar a ordem de exibição pelo campo **Ordem**
4. Tipos inativos não aparecem na abertura de solicitações

---

## 6. Fluxo operacional resumido

### Ciclo completo de atendimento

```
1. CLIENTE abre solicitação
   → Formulário em 4 passos
   → Seleciona tipos de serviço (multi-seleção)
   → Marca urgência se necessário
   → Status: SOLICITADO

2. ANALISTA recebe na fila
   → Visualiza solicitações ordenadas por urgência/data
   → Clica em "Assumir" → Status: EM ANÁLISE
   → Clica em "Iniciar orçamento" → Status: ORÇAMENTO EM ELABORAÇÃO

3. ANALISTA monta orçamento
   → Busca itens da tabela de preços do cliente
   → Adiciona quantidades, edita valores se necessário
   → Inclui itens manuais quando necessário
   → Define data provável de execução
   → Adiciona observações técnicas/comerciais
   → Clica em "Enviar ao cliente" → Status: ORÇAMENTO ENVIADO

4. CLIENTE recebe e decide
   → Vê o orçamento em "Orçamentos" ou na solicitação
   → Aprova → Status: APROVADO
   → Reprova (motivo obrigatório) → Status: REPROVADO
   → Coloca em espera → Status: EM ESPERA
   → Cancela (justificativa obrigatória) → Status: CANCELADO
```

---

## 7. Guia por perfil de usuário

### Cliente

| Ação | Onde |
|------|------|
| Abrir solicitação | Menu "Nova solicitação" |
| Acompanhar solicitações | Menu "Minhas solicitações" |
| Ver e decidir orçamentos | Menu "Orçamentos" ou no detalhe da solicitação |
| Alterar dados pessoais | Menu "Perfil" |
| Recuperar senha | Tela de login → "Esqueci minha senha" |

### Analista

| Ação | Onde |
|------|------|
| Ver fila de solicitações | Menu "Fila de solicitações" |
| Assumir uma solicitação | Detalhe → botão "Assumir" |
| Montar orçamento | Detalhe → "Iniciar orçamento" |
| Enviar orçamento ao cliente | QuoteBuilder → "Enviar ao cliente" |
| Ver orçamentos em andamento | Menu "Orçamentos" |
| Consultar clientes | Menu "Clientes" |
| Gerar relatório | Menu "Relatórios" |

### Administrador

Tudo do analista, mais:

| Ação | Onde |
|------|------|
| Criar/editar usuários | Menu "Usuários" |
| Criar/editar clientes | Menu "Clientes" |
| Configurar tabela de preços | Menu "Tabela de Preços" |
| Gerenciar tipos de serviço | Menu "Tipos de Serviço" |
| Exportar relatórios | Menu "Relatórios" → "Exportar CSV" |

---

## 8. Troubleshooting

### Container do backend não sobe

```bash
docker compose logs backend
```

Causas comuns:
- `DATABASE_URL` incorreta → verificar variável no `.env`
- PostgreSQL ainda inicializando → aguardar e tentar `docker compose restart backend`
- Porta 3000 ocupada → `lsof -i :3000` e encerrar processo

### Login retorna 401

- Verificar se `JWT_SECRET` no `.env` tem pelo menos 32 caracteres
- Verificar se o usuário está com status `ACTIVE` no banco
- Verificar se o e-mail e senha estão corretos (senha padrão do seed: `Admin@123456`)

### Orçamento não aparece para o cliente

- Verificar se o orçamento está com status `SENT` (não `DRAFT`)
- Verificar se o usuário cliente está vinculado ao cliente correto em **Usuários**
- Verificar se a solicitação está com status `QUOTE_SENT`

### Tabela de preços não aparece na montagem do orçamento

- Verificar se a tabela está com status `ACTIVE` (não `INACTIVE` ou `ARCHIVED`)
- Verificar se a tabela está vinculada ao **cliente correto** da solicitação
- Verificar se os itens têm status `ACTIVE`

### Exportação CSV com caracteres estranhos no Excel

O arquivo usa BOM UTF-8 (`\uFEFF`) para compatibilidade com Excel. Se aparecerem caracteres estranhos:
- No Excel: Dados → De Texto/CSV → Selecionar o arquivo → Encoding: UTF-8
- Ou abrir com LibreOffice que detecta o BOM automaticamente

### Performance lenta na fila de solicitações

Verificar se os índices foram criados:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'requests';
```
Deve retornar ao menos 6 índices. Se não, rodar novamente a migration.

### Erro "Cannot find module" no backend

```bash
docker compose exec backend npx prisma generate
docker compose restart backend
```

---

## 9. Checklist de deploy em produção

```
PRÉ-DEPLOY:
[ ] JWT_SECRET gerado com openssl rand -hex 32
[ ] POSTGRES_PASSWORD forte (20+ chars, sem caracteres especiais problemáticos)
[ ] CORS_ORIGIN apontando para o domínio real
[ ] Backup do banco se for atualização

DEPLOY:
[ ] docker compose pull (se usando imagens de registry)
[ ] docker compose build --no-cache
[ ] docker compose up -d
[ ] Aguardar 30s e verificar make health
[ ] make ps para confirmar todos os containers Up

PÓS-DEPLOY:
[ ] Testar login com admin
[ ] Verificar criação de solicitação de teste
[ ] Verificar montagem e envio de orçamento de teste
[ ] Alterar senha padrão do admin
[ ] Remover usuário de demonstração (cliente@demo.local)
```

---

## 10. Estrutura de arquivos de configuração

```
orcamentos-portal/
├── .env                  # ← NÃO versionar. Copiar de .env.example
├── .env.example          # Variáveis necessárias (sem valores reais)
├── .gitignore
├── docker-compose.yml    # Orquestração completa
├── Makefile              # Comandos de operação
├── README.md             # Visão geral e setup rápido
│
├── backend/
│   ├── .env.example      # Variáveis específicas do backend (dev)
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql  # Schema + triggers + funções
│   │       └── 002_seed.sql           # Dados iniciais
│   └── src/
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx-spa.conf    # Config nginx para SPA
│   └── src/
│
└── nginx/
    └── nginx.conf        # Proxy reverso principal
```
