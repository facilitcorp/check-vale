#!/usr/bin/env bash
# Cadeia completa de aceite com banco zerado: Admin → Parte 2 (tela + servidor) → Parte 3 (tela) → aparelho novo → axe do Admin;
# depois, num segundo banco zerado, Admin → Parte 3 (servidor).
# Uso (na raiz do repositório, depois de "npm ci && npm run build"):  bash qa/tela/rodar-tudo.sh
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/../.." && pwd); cd "$RAIZ"
PORTA_API=${PORTA_API:-3100}; PORTA_WEB=${PORTA_WEB:-5199}
export API="http://localhost:$PORTA_API/api" WEB="http://localhost:$PORTA_WEB"
export SAIDA=${SAIDA:-$RAIZ/qa/tela/saida}; mkdir -p "$SAIDA"; rm -f "$SAIDA"/*.log "$SAIDA"/*.json
# Porta ocupada (API ou preview de uma rodada anterior) faz o roteiro falar com o banco errado e falhar sem pista.
for porta in "$PORTA_API" "$PORTA_WEB"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$porta") 2>/dev/null; then echo "Porta $porta ocupada: encerre o processo que a usa (ou mude PORTA_API/PORTA_WEB)."; exit 2; fi
done
export DATA_DIR=$(mktemp -d) UPLOADS_DIR=$(mktemp -d)
echo "banco: $DATA_DIR  uploads: $UPLOADS_DIR  saída: $SAIDA"

PIDS=()
subir_api() { (cd apps/api && PORT=$PORTA_API CORS_ORIGENS=$WEB exec npx tsx src/servidor.ts >> "$SAIDA/api.log" 2>&1) & PIDS+=($!); API_PID=$!
  for _ in $(seq 60); do curl -sf "$API/saude" >/dev/null 2>&1 && return 0; sleep 1; done; echo "API não subiu"; exit 1; }
parar_api() { kill "$API_PID" 2>/dev/null || true; wait "$API_PID" 2>/dev/null || true; pkill -f "tsx src/servidor.ts" 2>/dev/null || true; sleep 1; } # o PGlite aceita um processo só
trap 'for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; pkill -f "tsx src/servidor.ts" 2>/dev/null || true' EXIT

(cd apps/web && API_URL="http://localhost:$PORTA_API" exec npx vite preview --port "$PORTA_WEB" --strictPort > "$SAIDA/web.log" 2>&1) & PIDS+=($!)
(cd qa/tela && [ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null && npx playwright install chromium >/dev/null)
[ -f "$SAIDA/foto-grande.jpg" ] || node qa/tela/gerar-fotos.mjs

subir_api
node qa/aceite-admin.mjs > "$SAIDA/aceite-admin.json"
node qa/tela/parte2.mjs | tee "$SAIDA/parte2.log"
parar_api
npx tsx qa/verifica-inspecao.mts > "$SAIDA/verifica-parte2.json"
subir_api
node qa/tela/parte3.mjs | tee "$SAIDA/parte3.log"
set +e
node qa/tela/aparelho-novo.mjs | tee "$SAIDA/aparelho-novo.log"; NOVO=${PIPESTATUS[0]}
node qa/tela/axe-admin.mjs | tee "$SAIDA/axe-admin.log"; AXE=${PIPESTATUS[0]}
set -e

# Parte 3 no servidor: publica V2/V3 no mesmo modelo, então roda num segundo banco zerado.
parar_api; export DATA_DIR=$(mktemp -d) UPLOADS_DIR=$(mktemp -d)
subir_api
node qa/aceite-admin.mjs > "$SAIDA/aceite-admin-2.json"
node qa/aceite-versoes-sync.mjs > "$SAIDA/parte3-servidor.json"

echo; echo "== Resumo =="
node --input-type=module -e '
import { readFileSync } from "node:fs";
const S = process.env.SAIDA; let falhas = 0;
const json = (a) => JSON.parse(readFileSync(`${S}/${a}`, "utf8").slice(readFileSync(`${S}/${a}`, "utf8").indexOf("{")));
for (const [nome, arq, chave] of [["Parte 1 — Admin (API)", "aceite-admin.json", "res"], ["Parte 2 — tela", "parte2.json", "passos"], ["Parte 2 — servidor", "verifica-parte2.json", "res"], ["Parte 3 — tela", "parte3.json", "passos"], ["Parte 3 — servidor", "parte3-servidor.json", "res"]]) {
  const r = json(arq)[chave]; const f = r.filter((x) => x.r !== "PASSOU"); falhas += f.length;
  console.log(`${f.length ? "✘" : "✔"} ${nome}: ${r.length - f.length}/${r.length}`); for (const x of f) console.log("   ✘", x.passo ?? x.p, x.ev ?? "");
}
process.exit(falhas ? 1 : 0);' && RES=0 || RES=1
echo "$([ $NOVO = 0 ] && echo ✔ || echo ✘) Aparelho novo"; echo "$([ $AXE = 0 ] && echo ✔ || echo ✘) axe do Admin"
exit $(( RES || NOVO || AXE ))
