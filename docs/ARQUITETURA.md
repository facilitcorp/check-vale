# CheckVale — Arquitetura (MVP)

## Visão geral

```
apps/web  (PWA React)  ──HTTP /api──▶  apps/api (Fastify)  ──SQL──▶  Postgres
   │ IndexedDB (Dexie): catálogo, veículos,                      │
   │ inspeções, fotos e FILA de sync                             └─ fotos: disco (MVP) → bucket
packages/shared: contratos zod + regras puras (resultado, escolha de modelo), usados pelos dois lados
```

Monorepo com npm workspaces. Node 22, TypeScript estrito.

## Princípios

1. **Offline-first.** O app grava tudo no aparelho e empilha operações numa fila. Sincroniza quando há rede (evento `online`, a cada 30 s e logo após cada gravação). Só o primeiro login exige internet.
2. **Ids gerados no aparelho (UUID).** A inspeção existe antes de chegar ao servidor.
3. **Sync idempotente.** Toda operação tem `opId`; o servidor registra em `sync_ops` e responde `duplicada` em reenvios. Reenviar é sempre seguro.
4. **Merge por item.** Para cada item vale a resposta com `respondidaEm` mais recente. Inspeção concluída nunca é reaberta.
5. **Uma só regra de resultado.** `calcularResultado` (shared) roda no app (telas offline) e na API (índice gravado e PDF). Os números são sempre iguais.
6. **Checklist é configuração.** Modelos versionados (`id`+`versao`) com filtros por tipo de veículo, área e atividade; `escolherModelo` pega o mais específico. Inspeção guarda a versão usada — alterar o modelo não altera o passado.
7. **Auditável.** Tabela `auditoria` (só INSERT) registra login, falhas de login, cada operação de sync, envio de foto e geração de relatório, com usuário, IP e horário.
8. **Marca em tokens.** Cores em `apps/web/src/estilos.css` (`@theme`), textos em `apps/web/src/marca.ts`. Componentes não usam cor literal.

## Banco

SQL puro sobre uma interface mínima (`Db.query/transacao`). Em dev/teste roda em **PGlite** (Postgres em WASM, sem instalar nada); em produção, `DATABASE_URL` aponta para Postgres. Migrações em `apps/api/src/db/migracoes.ts`, aplicadas na subida (tabela `_migracoes`). Nunca editar migração publicada.

## Segurança

- Senha com bcrypt; login com limite de 10 tentativas/min por IP; mesma resposta para e-mail inexistente e senha errada.
- JWT (`JWT_SECRET` obrigatório em produção). Rotas privadas exigem token. Inspetor só lê/escreve as próprias inspeções.
- Validação de toda entrada com zod (mesmo schema do app). Foto: só jpeg/png/webp, até 15 MB, tipo conferido com o registrado.
- Logs com `authorization` mascarado.

## Regras de resultado (MVP — validar com o produto)

- Índice de prontidão = conformes ÷ (respondidos − não se aplica).
- NC crítica ⇒ **Não apto**; outra NC ⇒ **Apto com restrições**; sem NC ⇒ **Apto**; antes de responder tudo ⇒ **Incompleta**.
- Ponto de atenção = NC média ou baixa. Plano de ação = todas as NCs, crítica primeiro.

## Fora do MVP (já previsto no desenho)

SSO Microsoft (Entra ID), assinatura do motorista, bucket de fotos em nuvem, painel do gestor, cadastro de modelos pela interface.

## Rodar local

```bash
npm install
npm run dev:api   # http://localhost:3000 (PGlite em memória + dados de demonstração)
npm run dev:web   # http://localhost:5173 (proxy /api → 3000)
# login demo: inspetor@checkvale.dev / checkvale
npm test && npm run typecheck && npm run build
```
