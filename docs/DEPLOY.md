# CheckVale — Operação (deploy, rollback, banco, backup)

Roteiro curto para quem publica. Infra (projeto, Cloud Run, Cloud SQL, bucket, segredos, IAM) é da
plataforma; este arquivo diz **o que** o CheckVale precisa e **como conferir**. Detalhe do contêiner
em `docs/STAGING.md`.

| | Staging |
|---|---|
| Serviço Cloud Run | `checkvale-staging` (região `southamerica-east1`) |
| Banco | `checkvale_staging` (Postgres, Cloud SQL) |
| Bucket das fotos | `facilitcorp-checkvale-staging-fotos` |
| Segredos | `checkvale-staging-database-url`, `checkvale-staging-jwt-secret`, `checkvale-staging-senha-demo` |

## Variáveis obrigatórias

| Variável | Origem | Regra (a API **não sobe** se falhar) |
|---|---|---|
| `DATABASE_URL` | segredo | Postgres do próprio ambiente |
| `JWT_SECRET` | segredo | 32+ caracteres aleatórios |
| `UPLOADS_BUCKET` | variável | bucket do ambiente; a conta de serviço precisa de `roles/storage.objectAdmin` só nele |
| `SENHA_DEMO` | segredo | 12+ caracteres, obrigatória quando `SEMEAR_DEMO=1` |

Opcionais: `SEMEAR_DEMO` (`1` em staging, **vazio em produção**), `AUTOCADASTRO` (`1` liga o
"Crie seu cadastro" em `/cadastro`, temporário, para teste: a pessoa escolhe e-mail e senha e entra
como inspetor; **vazio em produção**), `CORS_ORIGENS` (URL do serviço),
`JWT_VALIDADE` (padrão `12h`), `PROXIES_CONFIAVEIS` (padrão `1`, o front do Cloud Run; use `2` se
houver um Load Balancer na frente). `NODE_ENV`, `PORT` e `WEB_DIR` já vêm na imagem.

Se faltar algo, o log da revisão traz uma linha `CRITICAL` dizendo o quê, e a revisão não recebe tráfego.

## Deploy

1. Imagem a partir de um commit da `main` com CI verde, com tag = SHA do commit:
   `gcloud builds submit --tag southamerica-east1-docker.pkg.dev/<projeto>/<repo>/checkvale:<sha>`
2. Nova revisão do `checkvale-staging` com essa imagem (segredos e variáveis acima, Cloud SQL conectado).
   Sondagem de inicialização em `GET /api/saude`: ela só responde depois das migrações e com o banco no ar.
3. Conferir:
   - `GET /api/saude` → `{"ok":true,"versao":"0.1.1","revisao":"checkvale-staging-…"}`; a versão e a revisão dizem o que está no ar.
   - Log da subida: `CheckVale <versão> subindo…`, depois `Migração aplicada: …` (só se houver migração nova).
   - Roteiro de tela: `WEB=<url> INSPETOR_EMAIL=… INSPETOR_SENHA=… ADMIN_EMAIL=… ADMIN_SENHA=… node qa/tela/staging.mjs`.

## Rollback

- **Código:** devolver 100% do tráfego para a revisão anterior (`gcloud run services update-traffic
  checkvale-staging --to-revisions=<revisão-anterior>=100`). É instantâneo e não mexe no banco nem nas fotos.
- **Banco:** migração **não volta** sozinha. Toda migração é aditiva por regra (nunca editar uma já
  publicada); a revisão anterior continua funcionando sobre o banco novo. Se uma migração estragar dado,
  o caminho é restaurar backup (abaixo), nunca SQL manual em produção sem aprovação.

## Migrações

- Ficam em `apps/api/src/db/migracoes.ts` e rodam **na subida**, em ordem, registradas em `_migracoes`.
- Rodam numa transação só, com trava (`pg_advisory_xact_lock`): várias instâncias subindo juntas migram
  uma vez; se uma falhar, nada é aplicado e a revisão não sobe (a anterior segue no ar).
- Banco vazio: a primeira subida cria tudo. Com `SEMEAR_DEMO=1`, cria também o catálogo DEMO e
  `admin@checkvale.dev` / `inspetor@checkvale.dev` com a `SENHA_DEMO`. O seed só roda com o banco
  vazio (sem unidades) e usa a mesma trava: subir de novo não duplica nada.
- Trocar `SENHA_DEMO` depois **não** altera a senha de quem já foi criado; para isso, recriar o banco
  ou trocar a senha pelo Admin.

## Backup e restore

- **Banco:** backup automático diário e recuperação a um ponto no tempo (PITR) do Cloud SQL ligados na
  instância. Antes de publicar versão com migração nova, backup sob demanda. Restore: em **instância
  nova** (ou banco novo), conferir, e só então apontar o segredo `DATABASE_URL` para ela e publicar nova revisão.
- **Fotos:** versionamento de objetos ligado no bucket (foto apagada ou sobrescrita é recuperável).
  As chaves são `evidencias/<inspeção>/<evidência>`, as mesmas gravadas no banco: banco e bucket
  restaurados do mesmo momento ficam coerentes.

## Recriar o staging do zero

1. Banco `checkvale_staging` vazio (dropar e criar, ou banco novo) e bucket vazio.
2. Segredos com valores novos (`openssl rand -hex 32` para o JWT; `SENHA_DEMO` com 12+ caracteres).
3. Publicar a revisão: a subida migra e semeia sozinha. Nenhum script manual.
4. Conferir como no Deploy. Usuários de outros ambientes não existem aqui; sessões antigas caem (JWT novo).
