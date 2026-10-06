#!/usr/bin/env bash
# Tour visual com banco zerado: sobe a API do build servindo o app na mesma origem, semeia o DEMO e captura todas as telas.
# Uso (na raiz do repositório, depois de "npm ci && npm run build"):  bash qa/tela/rodar-tour.sh
# Capturas tour-*.png em qa/tela/saida/ (ou SAIDA=...). O rascunho v2 do Admin existe só neste banco temporário.
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/../.." && pwd); cd "$RAIZ"
PORTA=${PORTA:-3177}
export WEB="http://localhost:$PORTA" SAIDA=${SAIDA:-$RAIZ/qa/tela/saida} CRIAR_RASCUNHO=1; mkdir -p "$SAIDA"
if (exec 3<>"/dev/tcp/127.0.0.1/$PORTA") 2>/dev/null; then echo "Porta $PORTA ocupada: encerre o processo que a usa (ou mude PORTA)."; exit 2; fi
[ -f apps/api/dist/servidor.js ] && [ -f apps/web/dist/index.html ] || { echo "Falta o build: rode npm ci && npm run build"; exit 2; }
DATA_DIR=$(mktemp -d) UPLOADS_DIR=$(mktemp -d)

DATA_DIR=$DATA_DIR UPLOADS_DIR=$UPLOADS_DIR WEB_DIR=$RAIZ/apps/web/dist PORT=$PORTA CORS_ORIGENS=$WEB \
  node apps/api/dist/servidor.js > "$SAIDA/tour-api.log" 2>&1 & API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
for _ in $(seq 60); do curl -sf "$WEB/api/saude" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$WEB/api/saude" >/dev/null || { echo "API não subiu (veja $SAIDA/tour-api.log)"; exit 1; }

(cd qa/tela && { [ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null; } && npx playwright install chromium >/dev/null)
node qa/tela/tour.mjs
