# Analise Completa do Schema Prisma

## Objetivo

Este documento avalia o `schema.prisma` atual do Portal de Orcamentos com foco em:

- capacidade de suportar o sistema atual;
- eficiencia/performance em producao;
- consistencia e integridade de dados;
- seguranca e aprimoramentos no PostgreSQL;
- backlog objetivo do que falta implementar no banco.

---

## 1) Stack de Banco de Dados do Sistema

## Stack principal (em uso real no projeto)

- **SGBD**: PostgreSQL 16 (container `postgres:16-alpine` no `docker-compose`).
- **ORM**: Prisma ORM (`prisma` + `@prisma/client`).
- **Driver/acesso**: Prisma Client (Node.js/TypeScript).
- **Schema source of truth atual**: `backend/prisma/schema.prisma`.
- **Migrations atuais**: SQL versionado manual em `backend/prisma/migrations`.
- **Health/dependencias de dados**: backend valida PostgreSQL e considera Redis na saude.

## Componentes de dados complementares (nao sao banco relacional principal)

- **Redis 7**: usado como stack de suporte (cache/fila/sessao futura), nao substitui o PostgreSQL.
- **Nginx**: proxy/reverse proxy (camada de entrega), nao armazena dados.

## O que isso significa para o seu sistema

- Hoje o sistema esta em **arquitetura SQL-first com Prisma**: dominio no Prisma, mas com parte estrutural forte ainda baseada em SQL manual.
- Para alta confiabilidade de evolucao, o ideal e convergir para **Prisma Migrate como fluxo unico**, mantendo SQL manual apenas quando estritamente necessario (ex.: indices parciais especificos do PostgreSQL).

---

## 2) Diagnostico Geral

### Veredito rapido

O schema atual esta **bom para MVP e operacao inicial**, mas **ainda nao esta pronto para alta carga/escala de producao** sem ajustes.

### Pontos fortes

- Dominio bem modelado: usuarios, clientes, solicitacoes, orcamentos, itens e auditoria.
- Enums de negocio coerentes (`RequestStatus`, `QuoteStatus`, `UserRole`, etc).
- Relacionamentos principais corretos (1:N e N:N).
- Campos de auditoria basicos (`createdAt`, `updatedAt`, `deletedAt`) na maior parte das entidades.
- Estrutura consistente com os fluxos do backend.

### Gargalos atuais

- Poucos indices no Prisma para consultas de fila/listagens.
- Falta de constraints de unicidade em entidades criticas (`clients.document`, `service_types.name`, etc).
- Falta de estrategias explicitas de cascata/restricao (`onDelete`, `onUpdate`).
- Falta de garantias para regras de negocio no nivel banco (ex.: 1 cliente padrao por usuario).
- Dependencia atual de SQL manual para parte importante de performance/integridade.

---

## 3) Entidades Atuais e Avaliacao

## `User`
- **Proposito**: autenticacao, autorizacao e responsabilidade operacional.
- **Campos-chave**: `email`, `passwordHash`, `role`, `status`.
- **Relacoes**: solicita/cria/assume requests, cria quotes, auditoria.
- **Estado**: bom; falta index adicional para `status` e `deletedAt` via Prisma.

## `Client`
- **Proposito**: empresa/conta do cliente.
- **Campos-chave**: `name`, `document`, `isActive`.
- **Relacoes**: requests e tabelas de preco.
- **Estado**: bom; falta `@unique` opcional para `document` (com estrategia para `NULL`) e indice para busca.

## `ClientUser` (N:N)
- **Proposito**: vinculo usuario-cliente.
- **Campos-chave**: `userId`, `clientId`, `isDefault`.
- **Estado**: correto no `@@unique([userId, clientId])`.
- **Falta**: garantir no banco "no maximo 1 `isDefault=true` por `userId`" (ideal via indice parcial no PostgreSQL).

## `ServiceType`
- **Proposito**: catalogo de tipos de servico.
- **Estado**: funcional.
- **Falta**: unicidade de nome (global ou por escopo definido).

## `PriceTable` e `PriceItem`
- **Proposito**: base de precificacao por cliente.
- **Estado**: modelagem coerente.
- **Falta**:
  - unicidade de versao por cliente (`clientId + version`);
  - indice para filtros por status/validade;
  - regra para evitar duplicidade de `code` por tabela.

## `Request`
- **Proposito**: solicitacao de servico.
- **Estado**: muito completo.
- **Falta critica de performance**:
  - indices para filtros frequentes: `status`, `clientId`, `assignedTo`, `isUrgent`, `createdAt`, `deletedAt`.

## `RequestServiceType`
- **Proposito**: vinculo N:N request x tipo de servico.
- **Estado**: correto com `@@unique([requestId, serviceTypeId])`.
- **Falta**: indices individuais para joins pesados.

## `RequestHistory`
- **Proposito**: historico de transicoes da request.
- **Estado**: funcional.
- **Falta**: indice em `requestId + performedAt`.

## `Quote` e `QuoteItem`
- **Proposito**: montagem e decisao de orcamento.
- **Estado**: muito bom no dominio.
- **Falta critica de performance**:
  - indices por `requestId`, `status`, `createdBy`, `sentAt`.
  - em `QuoteItem`, indices por `quoteId`, `serviceTypeId`, `priceItemId`.

## `QuoteHistory`
- **Proposito**: trilha de auditoria do quote.
- **Estado**: correto.
- **Falta**: indice por `quoteId + performedAt`.

## `AuditLog`
- **Proposito**: auditoria geral do sistema.
- **Estado**: ja possui indices uteis; bom.

---

## 4) O schema vai dar conta do sistema?

### Sim, para:
- baixo/medio volume;
- poucas centenas de usuarios;
- algumas dezenas de milhares de requests/quotes.

### Risco de degradacao em:
- fila operacional com muitos filtros simultaneos;
- dashboards agregados com base crescente;
- historicos sem indices compostos;
- consultas por cliente/status/periodo com soft delete.

### Conclusao tecnica

Com os indices e constraints faltantes, o banco passa a atender o sistema com eficiencia real.  
Sem esses ajustes, tende a ficar lento na fila e em relatorios conforme o volume crescer.

---

## 5) O que esta faltando no banco (prioridade)

## P0 (fazer primeiro)

1. **Indices de fila e consulta operacional**
   - `Request(status, deletedAt, createdAt)`
   - `Request(clientId, deletedAt, createdAt)`
   - `Request(assignedTo, status, deletedAt)`
   - `Request(isUrgent, status, deletedAt)`
   - `Quote(requestId, status, deletedAt)`
   - `QuoteItem(quoteId)`

2. **Unicidade critica**
   - `ClientUser` default unico por usuario (indice parcial SQL).
   - `PriceTable(clientId, version)` unico.
   - `PriceItem(priceTableId, code)` unico (se regra de negocio permitir).

3. **Integridade relacional explicita**
   - definir `onDelete`/`onUpdate` conforme regra:
     - historicos/auditoria: normalmente `Restrict` ou `SetNull`.
     - tabelas filhas operacionais: `Cascade` onde apropriado.

## P1

4. **Indices para historico e auditoria**
   - `RequestHistory(requestId, performedAt)`
   - `QuoteHistory(quoteId, performedAt)`

5. **Busca e governanca de catalogos**
   - `ServiceType(name)` unico (ou com normalizacao case-insensitive).
   - `Client(document)` com estrategia de unicidade.

## P2

6. **Aprimoramento de governanca**
   - tabela de migrations 100% Prisma Migrate (eliminar drift).
   - padronizar tudo sem dependencia de SQL manual para regras centrais.

---

## 6) Integridade e consistencia: pontos de atencao

- `Quote` deve sempre apontar para `Request` valida e nao deletada logicamente.
- Decisao do cliente deve alterar quote + request em transacao (ja existe no backend e deve ser preservado).
- Soft delete exige filtros consistentes em todas as consultas (`deletedAt: null`).
- Regras de status deveriam ter reforco no banco quando viavel (check constraints via migration SQL).

---

## 7) Seguranca no PostgreSQL (o que melhorar)

## Obrigatorio para producao

- Usuario de app com privilegios minimos (nao usar superuser).
- SSL/TLS habilitado entre app e banco (quando fora da mesma rede interna segura).
- Backups automatizados + teste periodico de restore.
- Rotina de `VACUUM`/`ANALYZE` monitorada.
- `log_min_duration_statement` para identificar queries lentas.
- Rotacao e segredo forte para senha de banco.

## Recomendado

- extensao `pg_stat_statements` para tuning.
- timeouts de conexao/statement no app.
- monitoracao de locks e bloat de indices.
- politica de retention para historicos/auditoria (quando crescer muito).

---

## 8) Checklist para proxima etapa (implementacao)

1. Atualizar `schema.prisma` com indices e uniques prioritarios.
2. Gerar migrations Prisma reais e versionadas.
3. Aplicar migration em banco limpo e validar:
   - `prisma validate`
   - `prisma generate`
   - `prisma migrate dev`
   - `prisma migrate status`
4. Rodar smoke test dos fluxos:
   - login
   - abertura de request
   - criacao/envio de quote
   - decisao do cliente
5. Medir consultas principais com `EXPLAIN ANALYZE`.

---

## 9) Conclusao

O modelo atual esta **bem desenhado para o dominio**, mas ainda precisa de camada de **otimizacao e endurecimento de integridade** para garantir eficiencia e rapidez em producao.

Com os ajustes listados acima (principalmente P0), o banco fica pronto para sustentar o sistema com desempenho e consistencia.
