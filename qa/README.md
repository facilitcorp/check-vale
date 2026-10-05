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

Resultado em `9b16340`: 34 de 36 verificações passaram. As 2 que falharam (marca DEMO em cadastro do Admin) foram aceitas para depois do MVP.

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
