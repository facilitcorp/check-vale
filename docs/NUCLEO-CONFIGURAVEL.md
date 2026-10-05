# Núcleo configurável

Fluxo: **Operação → Veículos (atributos) → Modelo de checklist → Categorias → Itens → Regras → Publicar versão → Inspetor executa.**
Nenhuma pergunta é fixa no código: o app do inspetor só executa o que o ADMIN publicou.

## Perfis (RBAC)

Rotas e telas checam **permissão** (`packages/shared/src/permissoes.ts`), nunca o nome do perfil.

| Permissão | ADMIN | INSPETOR |
|---|---|---|
| `inspecao:executar` | ✓ | ✓ |
| `inspecao:ver_todas` | ✓ | |
| `config:ler` / `config:editar` | ✓ | |
| `modelo:publicar` | ✓ | |
| `usuario:gerenciar` | ✓ | |

Novo perfil (ex.: gestor, auditor) = uma linha no mapa `PERMISSOES_POR_PAPEL` + valor no CHECK de `usuarios.papel`.

## Cadastros (`/admin`)

- **Operação:** sites/complexos, áreas (por site ou todas), atividades. Ativo/inativo; inativo some do app.
- **Frota:** tipos de veículo, **atributos técnicos** (texto, número, sim/não, lista; por tipo de veículo; obrigatório opcional) e veículos (placa ou código, fabricante, modelo, empresa, status, atributos).
- **Usuários:** ADMIN e INSPETOR, senha inicial (mín. 8), ativo/inativo. Ninguém desativa o próprio acesso.
- Nada é apagado fisicamente. Toda alteração vai para a `auditoria`.
- Dados de demonstração têm `demo = true` e aparecem com selo **DEMO**. Não representam complexos, regras ou checklists oficiais.

## Modelos de checklist

- Ciclo: **rascunho → publicada → arquivada**. Só versão publicada chega ao app.
- Versão publicada é **imutável**. Para alterar: "Criar nova versão a partir desta" (copia, `versao+1`, mantém os ids dos itens).
- Publicar uma versão arquiva a anterior; inspeções em andamento nela continuam válidas.
- Publicação é bloqueada (422) se: modelo sem categorias, categoria sem itens, código repetido, regra usando atributo inexistente ou condição sem valor.
- **Prévia do inspetor:** escolhe um veículo real + área + atividade e mostra exatamente os itens que apareceriam.

## Regras de aplicabilidade

Existem no modelo (qual modelo serve), na categoria e no item. Critérios: tipos de veículo, áreas, atividades e condições por atributo (`igual`, `diferente`, `contem`, `maior`, `menor`, `preenchido`). Todos os critérios preenchidos precisam valer (E); dentro de uma lista basta um (OU). Vazio = sem restrição.

Motor puro em `packages/shared/src/regras.ts`, usado igual no app (offline) e na API (índice e PDF). Item fora da regra não é perguntado e **não conta no índice**.

A inspeção grava um **retrato do veículo** (`tipoVeiculoId` + `atributosVeiculo`): mudar o cadastro depois não altera inspeções já feitas.
