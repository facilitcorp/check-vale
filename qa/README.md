# Aceite do MVP

Roteiros de aceite que rodam contra uma API local com banco zerado. Não fazem parte do build.

## Parte 1 — Admin

```bash
DATA_DIR=$(mktemp -d) UPLOADS_DIR=$(mktemp -d) PORT=3100 npx tsx apps/api/src/servidor.ts &
node qa/aceite-admin.mjs   # API=http://host:porta/api para outro endereço
```

O script cria:
- operação, área e atividade;
- o tipo "Caminhão DEMO" com 4 atributos;
- os veículos DEM1A01 (reboque, freio a ar: vê 5 itens) e DEM1A02 (vê 3 itens);
- o inspetor `inspetor.aceite@checkvale.dev` (senha `aceite-2026`, só para teste local);
- o modelo "Checklist DEMO Aceite" V1 publicado.

A saída é um JSON com PASSOU/FALHOU por passo e os ids criados.

O script precisa de um banco zerado: rodar de novo no mesmo banco falha por código e placa repetidos.

DEMO não é campo de negócio: o contrato de criação não aceita `demo`, e o selo fica só nos dados da semente. O roteiro confere as duas coisas: a semente continua DEMO e o cadastro feito pelo Admin não vira DEMO (decisão do Paulo, 05/10/2026).

## Parte 2 — Inspetor + offline (lado do servidor)

Depois do fluxo visual, **pare a API** (o PGlite aceita um processo só) e rode, com o mesmo banco:

```bash
DATA_DIR=<o mesmo da API> UPLOADS_DIR=<o mesmo da API> npx tsx qa/verifica-inspecao.mts
```

Para cada inspeção sincronizada, o script confere:
- veículo e versão publicada;
- nenhuma resposta em item fora da regra (usa o retrato do veículo gravado na inspeção);
- resultado gravado no servidor igual ao recalculado com as funções do app;
- cada NC com descrição, criticidade e foto, e presente no plano de ação;
- cada foto ligada ao item certo, com arquivo no disco, em JPEG de até 400 KB (prova a compressão).

No geral, confere também:
- fila de sync sem nenhuma operação rejeitada;
- cada operação aplicada uma única vez (auditoria `sync.*` = `sync_ops`).

O script também imprime a contagem da auditoria.

## Parte 3 — Versões, retrato e recusa (lado do servidor)

Com a API no ar e depois do `aceite-admin.mjs`: `node qa/aceite-versoes-sync.mjs`. O script:
- abre uma inspeção na V1;
- publica a V2 (com um item alterado e um item novo) e depois a V3 (com um item removido);
- altera o veículo;
- confere que a inspeção antiga mantém a V1, o retrato do veículo e as respostas, e que conclui normalmente;
- confere que a inspeção nova recebe a V2;
- confere que um item da V2 numa inspeção da V1 é recusado;
- confere que a placa duplicada é recusada com o motivo.

Depois, o `verifica-inspecao.mts` deve mostrar exatamente 2 operações rejeitadas: as duas foram provocadas de propósito.

## Roteiros de tela (Partes 2 e 3, aparelho novo, axe do Admin)

Ficam em `qa/tela/`, num pacote próprio (Playwright e axe), fora dos workspaces e do build. A cadeia inteira, com banco zerado, roda com um comando só:

```bash
npm ci && npm run build
bash qa/tela/rodar-tudo.sh   # PORTA_API=3100 PORTA_WEB=5199 SAIDA=qa/tela/saida por padrão
```

O `rodar-tudo.sh` sobe a API (banco e uploads em pastas temporárias) e o `vite preview` do app. Instala o Playwright em `qa/tela/` se faltar e gera as fotos de teste (`gerar-fotos.mjs`: JPEG com cara de foto, acima de 1 MB). Depois roda, nesta ordem:

| Passo | Script | O que prova |
|---|---|---|
| Parte 1 | `qa/aceite-admin.mjs` | Admin pela API; os ids vão para `saida/aceite-admin.json` |
| Parte 2, tela | `qa/tela/parte2.mjs` | inspetor no celular, online e offline, fotos comprimidas, estados de sync, axe |
| Parte 2, servidor | `qa/verifica-inspecao.mts` | com a API parada, confere no banco o que a tela gravou |
| Parte 3, tela | `qa/tela/parte3.mjs` | V1 continua após V2/V3, retrato do veículo, recusa de placa duplicada, versão ausente (sem rede: aviso; com rede: volta sozinha), axe |
| Aparelho novo | `qa/tela/aparelho-novo.mjs` | IndexedDB vazio e rota de versões atrasada em 3 s (`ATRASO_VERSOES_MS`): todo cartão abre na versão da inspeção, sem "indisponível" em nenhum momento |
| axe do Admin | `qa/tela/axe-admin.mjs` | WCAG 2.1 AA em 7 telas × desktop e celular, 0 erro de console |
| Parte 3, servidor | `qa/aceite-versoes-sync.mjs` | num **segundo** banco zerado, porque publica V2/V3 no mesmo modelo da Parte 3 de tela |

No fim, ele imprime o resumo por parte e sai com 1 se algo falhou. Capturas, JSONs e logs ficam em `qa/tela/saida/`, que está no `.gitignore`.

Cada script também roda sozinho, com a API e o app no ar: `WEB`, `API`, `SAIDA`, `IDS_ADMIN` e, na Parte 2, `UPLOADS_DIR`, a mesma pasta de uploads da API.

As esperas são por estado, não por tempo. Um cartão em "Carregando…" não é lido como resultado: era isso que dava o falso ✘ da 1ª rodada.

## Ambiente publicado (staging)

`qa/tela/staging.mjs` passa pelo app só pelo navegador, sem banco nem pasta de uploads, usando o primeiro cadastro DEMO que o ambiente oferecer. Roda o inspetor em 390×844 (com uma NC feita sem rede) e em desktop: login, Home, checklist, NC com foto, resultado, PDF, plano de ação, histórico e bloqueio do `/admin`. Depois o Admin nas duas telas. Também confere HTTPS, manifest e service worker, e lista todo erro de console, exceção e resposta HTTP ≥ 400.

```bash
cd qa/tela && WEB=https://<staging> INSPETOR_EMAIL=... INSPETOR_SENHA=... ADMIN_EMAIL=... ADMIN_SENHA=... node staging.mjs
```

As credenciais vêm só do ambiente. Cada rodada cria 2 verificações DEMO no staging. As capturas `stg-*.png` e o `staging.json` ficam em `saida/`.

## Tour visual

`qa/tela/tour.mjs` captura todas as telas em 390×844 (celular) e 1440×900 (desktop), com dados DEMO. Faz uma verificação de verdade (2 NCs com foto, uma crítica) e passa pelo Admin. Com banco zerado, um comando só:

```bash
npm ci && npm run build
bash qa/tela/rodar-tour.sh   # PORTA=3177 SAIDA=qa/tela/saida por padrão
```

O `rodar-tour.sh` sobe a API do build servindo o app na mesma origem, com banco e uploads temporários. As capturas `tour-*.png` ficam em `saida/`. O rascunho v2 das telas 15b/16 existe só nesse banco temporário; nada é publicado.

Contra outro ambiente: `WEB=https://... INSPETOR_EMAIL=... INSPETOR_SENHA=... ADMIN_EMAIL=... ADMIN_SENHA=... node qa/tela/tour.mjs`. Fora do localhost, as credenciais vêm só do ambiente, cada rodada cria 2 verificações DEMO e o rascunho só é criado com `CRIAR_RASCUNHO=1`.
