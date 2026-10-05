import { Route } from 'react-router-dom';
import { TelaCategorias } from './telas/TelaCategorias';
import { TelaHistorico } from './telas/TelaHistorico';
import { TelaInicio } from './telas/TelaInicio';
import { TelaItem } from './telas/TelaItem';
import { TelaNaoConformidade } from './telas/TelaNaoConformidade';
import { TelaPlanoAcao, TelaResultado, TelaResultadoCategorias } from './telas/TelasResultado';

export { rotas as rotasInspecao } from './rotas';

/**
 * Rotas do fluxo do inspetor (início, histórico e telas 5–12). Sem proteção
 * aqui: quem encaixa no roteador decide (App envolve cada uma em <Protegida>).
 */
export const telasDaInspecao = [
  { caminho: '/', elemento: <TelaInicio /> },
  { caminho: '/historico', elemento: <TelaHistorico /> },
  { caminho: '/inspecao/:inspecaoId', elemento: <TelaCategorias /> },
  { caminho: '/inspecao/:inspecaoId/item/:itemId', elemento: <TelaItem /> },
  { caminho: '/inspecao/:inspecaoId/item/:itemId/nao-conformidade', elemento: <TelaNaoConformidade /> },
  { caminho: '/inspecao/:inspecaoId/resultado', elemento: <TelaResultado /> },
  { caminho: '/inspecao/:inspecaoId/resultado/categorias', elemento: <TelaResultadoCategorias /> },
  { caminho: '/inspecao/:inspecaoId/plano', elemento: <TelaPlanoAcao /> },
];

/** Para testes: as mesmas rotas, sem a sessão. */
export const rotasDaInspecao = telasDaInspecao.map((t) => <Route key={t.caminho} path={t.caminho} element={t.elemento} />);
