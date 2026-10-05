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
