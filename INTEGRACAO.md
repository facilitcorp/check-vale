# Integração do fluxo do inspetor na base real (feat/nucleo-configuravel)

Roteiro mecânico. Nenhuma tela muda de comportamento: só imports e a remoção
do que duplica a fundação. Executar SOMENTE depois que `origin/feat/nucleo-configuravel` existir.

## Ordem (definida pelo Paulo)

1. dev-1 publica `main` e `feat/nucleo-configuravel`.
2. dev-2 publica esta branch como `feat/fluxo-inspecao-original` (backup, sem PR).
3. dev-2 cria `feat/fluxo-inspecao` a partir de `origin/feat/nucleo-configuravel`.
4. Traz só o que está em "Fica" abaixo, aplica as trocas, roda testes e QA, abre PR para o dev-1.

## Fica (vem desta branch)

| Caminho aqui | O que é |
|---|---|
| `src/features/inspecao/telas/*` | Telas: início, histórico, categorias/progresso, item, não conformidade, resultado, por categoria, plano |
| `src/features/inspecao/componentes/*` | Moldura (topo, estados, aviso sem sinal, aviso "Salvo no aparelho", selos), Evidências, Ícone |
| `src/features/inspecao/rotas.ts`, `index.tsx` | Rotas do fluxo para o roteador da fundação |
| `src/infra/branding/marca.ts` | Marca por configuração (se a fundação já tiver equivalente, usar o dela) |
| `src/estilos.css` | Converter para Tailwind da fundação, mantendo contraste AA e alvos ≥ 44 px |
| testes de tela (`fluxo.test.tsx`, `inicio.test.tsx`) | Reapontar a montagem para os provedores da fundação |

## Sai (duplica a fundação)

| Caminho aqui | Substituído por (fundação) |
|---|---|
| `src/contracts/checklist.ts` | tipos do pacote `shared` |
| `src/infra/offline/banco.ts`, `fila.ts` (inclui o contador de revisão), `imagem.ts` | banco local, fila (concorrência coberta por `opId` + lote marcado "enviando", teste em `dados/concorrencia.test.ts`, 085214b) e compressão dentro de `adicionarEvidencia` |
| `src/features/inspecao/dados/repositorio.ts` | `repositorioInspecao` |
| `src/features/inspecao/dominio/resultado.ts` | cálculo compartilhado (app = API = PDF) |
| `src/features/inspecao/dados/ganchos.ts` | `useChecklistDaInspecao` real (`dados/ganchos.ts`) |
| `src/features/inspecao/dados/estadoSync.ts` | `useSituacaoSyncInspecao`, `useSituacaoSyncGeral`, `ROTULO_SYNC` reais (`dados/estadoSync.ts`) |
| `src/features/inspecao/dados/modelo-exemplo.ts` | modelo publicado pelo admin |
| `src/main.tsx` (casca provisória, `?falhar=1`) | app da fundação |

## Trocas pontuais nas telas

| Onde | Hoje (adaptador) | Na base real |
|---|---|---|
| todas as telas | `import { useChecklistDaInspecao } from '../dados/ganchos'` | mesmo nome, gancho da fundação |
| início, histórico, categorias, resultado, Moldura | `../dados/estadoSync` | mesmo nome, módulo da fundação |
| `contexto.tsx` → `useTentarAgora` | `fila.processar()` | `sincronizar()` de `dados/sincronizacao.ts` |
| TelaItem / TelaNaoConformidade | `repo.responder(...)` | `salvarResposta` do `repositorioInspecao` |
| Evidências | `comprimirImagem` + `repo.adicionarEvidencia` | só `adicionarEvidencia` (já comprime) |
| remover foto | `repo.removerEvidencia` | `salvarResposta` sem o id (foto fica no servidor sem vínculo) |
| resultado | `abrirRelatorio` via provedor | `abrirRelatorio(inspecaoId)` de `lib/relatorio.ts` |
| plano de ação (tela 12) | `resultado.plano`, item `tituloItem` | `resultado.planoAcao`, item `itemTitulo` (confirmado pelo dev-1; já vem ordenado: crítica primeiro, depois ordem do checklist). As fotos do item continuam vindo por `itemId` |
| início | — | trazer o aviso de **registros recusados** da tela inicial da fundação, acima do cartão de sincronização |

## Aceite antes do PR

- `tsc`, testes de tela e testes da fundação verdes (rodar 3 vezes: os de fluxo são sensíveis a tempo).
- QA a 390×844: axe sem violações; nenhum alvo < 44 px; ação principal no terço inferior;
  sem rede → volta rede; erro → "Tentar agora"; inspeção inexistente; modelo ausente.
- Concluir verificação NÃO pode navegar duas vezes (a tela redireciona sozinha ao gravar `concluida`).
