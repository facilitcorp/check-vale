import { Route } from 'react-router-dom';
import { TelaCategorias } from './telas/TelaCategorias';
import { TelaItem } from './telas/TelaItem';
import { TelaNaoConformidade } from './telas/TelaNaoConformidade';
import { TelaPlanoAcao, TelaResultado, TelaResultadoCategorias } from './telas/TelasResultado';

export { ProvedorInspecao, useInspecao } from './contexto';
export { RepositorioInspecao } from './dados/repositorio';
export { rotas as rotasInspecao } from './rotas';

/** Rotas do fluxo da inspeção, para a fundação encaixar no roteador dela. */
export const rotasDaInspecao = (
  <>
    <Route path="/inspecao/:verificacaoId" element={<TelaCategorias />} />
    <Route path="/inspecao/:verificacaoId/item/:itemId" element={<TelaItem />} />
    <Route path="/inspecao/:verificacaoId/item/:itemId/nao-conformidade" element={<TelaNaoConformidade />} />
    <Route path="/inspecao/:verificacaoId/resultado" element={<TelaResultado />} />
    <Route path="/inspecao/:verificacaoId/resultado/categorias" element={<TelaResultadoCategorias />} />
    <Route path="/inspecao/:verificacaoId/plano" element={<TelaPlanoAcao />} />
  </>
);
