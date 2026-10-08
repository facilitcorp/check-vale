import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LogOut, Settings } from 'lucide-react';
import { pode, type Inspecao } from '@checkvale/shared';
import { Aviso } from '../../componentes/ui';
import { banco, type OpFila } from '../../dados/banco';
import { useSituacaoSyncGeral, useSituacaoSyncInspecao, type SituacaoSync } from '../../dados/estadoSync';
import { useCatalogo, useChecklistDaInspecao } from '../../dados/ganchos';
import { repositorioInspecao } from '../../dados/repositorio';
import { sair, useSessao } from '../../dados/sessao';
import { BarraProgresso, Moldura, SeloDemo, SeloSituacao } from '../componentes/Moldura';
import { useTentarAgora } from '../contexto';
import { rotas } from '../rotas';
import { dataHora, identificacaoVeiculo, nomeVeiculo, useDescricaoInspecao } from './formatos';
import { LinhaHistorico } from './TelaHistorico';

const ULTIMOS = 3;
/** Início do fluxo de nova verificação (operação → veículo), da fundação. */
const ROTA_NOVA_VERIFICACAO = '/nova';

/** Tela inicial do inspetor: continuar o que está aberto, começar outra, ver as últimas. */
export function TelaInicio() {
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const catalogo = useCatalogo();
  const todas = useLiveQuery(() => repositorioInspecao.listar(), []);
  // Operações que o servidor recusou de vez (ex.: placa já cadastrada por outro aparelho): o inspetor precisa ver.
  const rejeitadas = useLiveQuery(() => banco.fila.where('estado').equals('rejeitada').toArray(), []);
  const emAndamento = todas?.filter((v) => v.status === 'em_andamento') ?? [];
  const concluidas = todas?.filter((v) => v.status === 'concluida') ?? [];

  return (
    <Moldura
      direita={
        <button aria-label="Sair" onClick={() => void sair()} className="flex size-11 items-center justify-center rounded-full active:bg-white/10">
          <LogOut size={20} />
        </button>
      }
      rodape={
        <>
          {catalogo === null && <p className="dica centro">Baixando dados para uso offline… conecte-se à internet.</p>}
          <button className="botao botao--primario" disabled={!catalogo} onClick={() => navegar(ROTA_NOVA_VERIFICACAO)}>
            Nova verificação
          </button>
        </>
      }
    >
      <h1>Verificações</h1>
      {!!rejeitadas?.length && <AvisoRecusas rejeitadas={rejeitadas} />}
      <CartaoSincronizacao />
      {usuario && pode(usuario.papel, 'config:ler') && (
        <Link to="/admin" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-marca font-semibold text-marca">
          <Settings size={18} /> Administração
        </Link>
      )}

      {todas === undefined ? (
        <div className="carregando" aria-busy="true" aria-label="Carregando">
          <span className="carregando__bloco" />
          <span className="carregando__bloco" />
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section className="secao" aria-labelledby="titulo-andamento">
              <h2 id="titulo-andamento">Em andamento</h2>
              <ul className="lista">
                {emAndamento.map((v) => (
                  <li key={v.id}>
                    <CartaoAndamento verificacao={v} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="secao" aria-labelledby="titulo-ultimos">
            <div className="secao__topo">
              <h2 id="titulo-ultimos">Últimos checklists</h2>
              {concluidas.length > 0 && (
                <Link className="link" to={rotas.historico()}>
                  Ver histórico
                </Link>
              )}
            </div>
            {concluidas.length === 0 ? (
              <p className="vazio vazio--curto">Nenhum checklist concluído neste aparelho ainda.</p>
            ) : (
              <ul className="lista">
                {concluidas.slice(0, ULTIMOS).map((v) => (
                  <li key={v.id}>
                    <LinhaHistorico verificacao={v} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Moldura>
  );
}

/** O que foi recusado, de qual veículo e por quê. Os dados continuam no aparelho e podem ir de novo. */
function AvisoRecusas({ rejeitadas }: { rejeitadas: OpFila[] }) {
  const veiculos = useLiveQuery(() => banco.veiculos.toArray(), []);
  const inspecoes = useLiveQuery(() => banco.inspecoes.toArray(), []);
  const placa = (id: string) => identificacaoVeiculo(veiculos?.find((x) => x.id === id));
  const verificacao = (i: Inspecao) => `Verificação ${placa(i.veiculoId)}, iniciada em ${dataHora(i.iniciadaEm)}`;
  const oQue = ({ op }: OpFila) => {
    if (op.tipo === 'inspecao.salvar') return verificacao(op.inspecao);
    if (op.tipo === 'veiculo.salvar') return `Cadastro do veículo ${op.veiculo.placa ?? op.veiculo.codigo ?? ''}`.trim();
    const dona = inspecoes?.find((i) => i.id === op.evidencia.inspecaoId);
    return dona ? `Foto da ${verificacao(dona).replace('Verificação', 'verificação')}` : 'Foto de uma verificação';
  };
  return (
    <div className="secao">
      <Aviso tom="erro">
        <p className="font-semibold">{rejeitadas.length} registro(s) não aceito(s) pelo servidor:</p>
        <ul className="mt-1 list-disc pl-5">
          {rejeitadas.slice(0, 5).map((o) => (
            <li key={o.seq}>
              <span className="font-semibold">{oQue(o)}:</span> {o.erro ?? 'Recusado pelo servidor.'}
            </li>
          ))}
        </ul>
        <p className="mt-1">Os dados continuam salvos neste aparelho. Corrija e salve de novo, ou procure o gestor da operação.</p>
      </Aviso>
    </div>
  );
}

const AJUDA_SYNC: Record<SituacaoSync, string> = {
  salvo_no_aparelho: 'Suas respostas estão guardadas e sobem sozinhas.',
  sem_conexao: 'Pode continuar: tudo fica salvo no aparelho e sobe quando o sinal voltar.',
  aguardando_envio: 'Será enviado na próxima tentativa.',
  sincronizando: 'Enviando para o servidor…',
  tudo_enviado: 'Nada pendente neste aparelho.',
  erro: 'Nada foi perdido. O envio é repetido sozinho; você também pode tentar agora.',
};

function CartaoSincronizacao() {
  const estado = useSituacaoSyncGeral();
  const tentarAgora = useTentarAgora();
  if (!estado) return null;
  const { situacao, pendencias } = estado;
  const partes = [
    pendencias.operacoes > 0 && `${pendencias.operacoes} registro${pendencias.operacoes > 1 ? 's' : ''}`,
    pendencias.fotos > 0 && `${pendencias.fotos} foto${pendencias.fotos > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return (
    <div className={`cartao-sync cartao-sync--${situacao}`}>
      <div>
        <SeloSituacao situacao={situacao} />
        <p className="dica">
          {AJUDA_SYNC[situacao]}
          {partes.length > 0 && ` Pendente: ${partes.join(' e ')}.`}
        </p>
      </div>
      {situacao === 'erro' && (
        <button className="botao botao--secundario botao--compacto" onClick={tentarAgora}>
          Tentar agora
        </button>
      )}
    </div>
  );
}

function CartaoAndamento({ verificacao: v }: { verificacao: Inspecao }) {
  const navegar = useNavigate();
  const dados = useChecklistDaInspecao(v.id);
  const resultado = dados.carregando ? null : dados.resultado;
  const situacao = useSituacaoSyncInspecao(v.id)?.situacao;
  const { veiculo, operacao } = useDescricaoInspecao(v);
  const placa = identificacaoVeiculo(veiculo);
  return (
    <article className="cartao-inspecao" aria-label={`Verificação em andamento: ${placa}`}>
      <div className="cartao-inspecao__topo">
        <div>
          <span className="linha__titulo">
            <strong className="placa">{placa}</strong>
            <SeloDemo veiculo={veiculo} />
          </span>
          <p className="sub">{nomeVeiculo(veiculo)}</p>
        </div>
        <SeloSituacao situacao={situacao} />
      </div>
      <p className="dica">{operacao}</p>
      {resultado ? (
        <>
          <BarraProgresso valor={resultado.respondidos} total={resultado.total} />
          <p className="dica">
            {resultado.respondidos} de {resultado.total} itens · iniciada em {dataHora(v.iniciadaEm)}
          </p>
        </>
      ) : (
        <p className="dica">
          {dados.carregando ? 'Carregando…' : 'Checklist indisponível neste aparelho. Conecte-se para sincronizar.'}
        </p>
      )}
      <button className="botao botao--primario" onClick={() => navegar(rotas.categorias(v.id))}>
        Continuar verificação
      </button>
    </article>
  );
}
