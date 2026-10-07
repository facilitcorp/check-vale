# Biblioteca de checklists por setor (marco 2 — rascunho de contrato)

Fluxo: **Biblioteca → setor → modelo da biblioteca → prévia do que será verificado → (a) usar modelo | (b) personalizar para minha empresa | (c) criar do zero.**

## Princípios

- **Setor é cadastro, não código.** Os 10 setores iniciais entram por semente; o ADMIN cria, renomeia, ordena e inativa. Nenhuma tela ou regra depende do nome/quantidade de setores.
- **Origem honesta do conteúdo.** Todo modelo da biblioteca tem `origem`:
  - `base_checkvale` → selo **"Modelo Base CheckVale"**
  - `referencia` → selo **"Modelo de referência"** (exige `fonte` descrita).
  Não existe valor "oficial". Nada cita Vale, mineradora, concessionária, cliente, lei ou contrato como requisito sem fonte validada. Texto de selo vem do mapa em `packages/shared`, nunca solto em componente.
- **Biblioteca é catálogo, empresa é cópia.** Usar/personalizar **copia** o conteúdo para `modelos_checklist` (o núcleo que já existe: rascunho → publicada → arquivada). Mudar a biblioteca depois não altera checklists já adotados nem inspeções.
- **Rastreio da origem.** O modelo adotado guarda `biblioteca_modelo_id` + `biblioteca_versao`.

## Dados (migração nova, sem editar as publicadas)

| Tabela | Campos principais |
|---|---|
| `setores` | `id uuid`, `nome`, `descricao`, `icone` (chave de ícone), `ordem int`, `ativo bool`, `demo bool` |
| `biblioteca_modelos` | `id uuid`, `versao int`, `setor_ids uuid[]` (um modelo pode servir a mais de um setor), `nome`, `resumo`, `origem` CHECK (`base_checkvale`,`referencia`), `fonte text null`, `categorias jsonb` (mesmo formato de `CategoriaChecklist`), `status` (`rascunho`,`publicada`,`arquivada`), PK (`id`,`versao`) |
| `modelos_checklist` (+colunas) | `biblioteca_modelo_id uuid null`, `biblioteca_versao int null` |

Itens copiados da biblioteca saem **sem regra de aplicabilidade** (tipos de veículo/áreas/atividades são da empresa); o ADMIN ajusta na personalização.

## API (permissões novas em `permissoes.ts`)

- `biblioteca:ler` (ADMIN) · `biblioteca:editar` (ADMIN; depois vira perfil de curadoria da plataforma)
- `GET  /api/biblioteca/setores` → setores ativos com contagem de modelos publicados
- `GET  /api/biblioteca/modelos?setorId=` → lista (nome, resumo, selo, nº de categorias/itens)
- `GET  /api/biblioteca/modelos/:id` → versão publicada completa (prévia)
- `POST /api/biblioteca/modelos/:id/adotar` `{ modo: "usar" | "personalizar", nome? }` →
  - `usar`: cria modelo da empresa já **publicado** (passa pelas mesmas validações de publicação);
  - `personalizar`: cria **rascunho** e devolve o id para abrir no editor de modelos.
- Cadastro de setores e curadoria: `GET/POST/PATCH /api/admin/setores`, `GET/POST/PATCH /api/admin/biblioteca/modelos` (+ publicar versão, igual ao núcleo).
- Tudo auditado.

## Telas (web)

`/admin/biblioteca` (setores em cartões) → `/admin/biblioteca/:setorId` (modelos com selo) → `/admin/biblioteca/modelo/:id` (prévia por categoria; botões Usar / Personalizar) · "Criar do zero" leva ao editor atual. Cadastro de setores em `/admin/setores`.
