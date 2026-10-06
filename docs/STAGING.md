# CheckVale — Staging

Um serviço só: o contêiner (`Dockerfile` na raiz) roda a API, que também serve a PWA compilada
na mesma origem. O app chama `/api` por caminho relativo: sem CORS e um único certificado HTTPS.

## Imagem

```bash
gcloud builds submit --tag southamerica-east1-docker.pkg.dev/<projeto>/<repo>/checkvale:<git_sha>
```

Escuta na porta `8080`. Saúde: `GET /api/saude` (faz `SELECT 1` no banco).

## Variáveis de ambiente

| Variável | Staging | Observação |
|---|---|---|
| `NODE_ENV` | `production` (já na imagem) | liga log JSON e exige `JWT_SECRET` |
| `DATABASE_URL` | **segredo** | Postgres **só de staging**, nunca o de produção. Cloud SQL por socket: `postgres://USUARIO:SENHA@/BANCO?host=/cloudsql/PROJETO:REGIAO:INSTANCIA` |
| `JWT_SECRET` | **segredo** | 32+ caracteres aleatórios |
| `SENHA_DEMO` | **segredo** | senha dos usuários de demonstração |
| `SEMEAR_DEMO` | `1` | no banco vazio cria só dados DEMO: catálogo, veículos, `admin@checkvale.dev` e `inspetor@checkvale.dev` |
| `UPLOADS_BUCKET` | nome do bucket | fotos no Cloud Storage. A conta de serviço precisa de `roles/storage.objectAdmin` **só nesse bucket**. O disco do Cloud Run é efêmero: sem bucket, as fotos somem a cada reinício |
| `CORS_ORIGENS` | URL do serviço | só importa se outra origem chamar a API; o app usa a mesma origem |
| `WEB_DIR` | `/app/web` (já na imagem) | desligar = só API |

Migrações rodam sozinhas na subida (tabela `_migracoes`).

## Conferência depois de publicar

1. `GET /api/saude` → `{"ok":true}`
2. Abrir a URL, entrar como `inspetor@checkvale.dev` e como `admin@checkvale.dev`
3. O roteiro de tela roda contra a URL: `API=<url>/api WEB=<url> node qa/aceite-admin.mjs`
