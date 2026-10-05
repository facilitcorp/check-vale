# Contratos e pontos de integração

Fonte da verdade: `packages/shared/src` (`dominio.ts`, `api.ts`, `resultado.ts`, `modelo.ts`). Este arquivo só orienta.

## Rotas da API (prefixo `/api`)

| Método | Rota | Uso |
|---|---|---|
| POST | `/auth/login` | `{email, senha}` → `{token, expiraEm, usuario}` |
| GET | `/auth/eu` | usuário da sessão |
| GET | `/catalogo` | unidades, áreas, atividades, tipos de veículo, modelos (ETag) |
| GET | `/catalogo/modelos/:id/versoes/:v` | versão exata (publicada ou arquivada) de uma inspeção recebida; rascunho → 404 |
| GET | `/veiculos?desde=` | veículos alterados desde o cursor |
| GET | `/inspecoes?desde=` | inspeções do inspetor alteradas desde o cursor |
| POST | `/sync` | lote de até 100 operações (`veiculo.salvar`, `inspecao.salvar`, `evidencia.registrar`) |
| PUT/GET | `/evidencias/:id/arquivo` | binário da foto |
| GET | `/inspecoes/:id/relatorio.pdf` | relatório |

## App: como as telas gravam

Telas NUNCA chamam a API para gravar. Usam `apps/web/src/dados/repositorio.ts`:

```ts
repositorioInspecao.criar(ctx)                         // tela 4
repositorioInspecao.obter(id) / useInspecao(id)        // leitura reativa (dados/ganchos.ts)
repositorioInspecao.salvarResposta(id, resposta)       // telas 6 e 8 (valida NC: descrição + foto)
repositorioInspecao.adicionarEvidencia(id, itemId, blob) → Evidencia   // tela 7; já comprime (~300 KB); use evidencia.id em evidenciaIds
repositorioInspecao.arquivoEvidencia(evidenciaId)      // miniatura
repositorioInspecao.concluir(id)                       // tela 9 → 10
calcularResultado(modelo, inspecao.respostas)          // telas 9–12 (shared)
```

Modelo da inspeção: `useChecklistDaInspecao(id)` (`dados/ganchos.ts`), que lê a versão exata em `banco.modelos`. O sync guarda toda versão do catálogo e baixa as que faltam para as inspeções do aparelho.

## Rotas reservadas do app (telas 5–12)

`/inspecao/:id` (categorias e progresso), `/inspecao/:id/item/:itemId`, `/inspecao/:id/resultado`, `/inspecao/:id/plano`. Hoje apontam para `telas/ChecklistProvisorio.tsx`, a substituir.

## Componentes base

`componentes/ui.tsx`: `Cabecalho`, `Tela` (com `rodape` fixo), `Botao` (`primario|secundario|fantasma`), `Campo`, `Selecao`, `Rotulo`, `Aviso`, `Logo`, `IndicadorSync`. Cores só por token (`bg-marca`, `text-destaque`, `text-ok`, `text-atencao`, `text-erro`...).
