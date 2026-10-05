import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Veiculo } from '@/contracts/checklist';
import { useEstadoFila, useInspecao } from '../contexto';
import { Icone } from './Icone';

/** Cabeçalho verde com a marca, voltar e o estado da sincronização. */
export function Moldura(props: { voltarPara?: string; children: ReactNode; rodape?: ReactNode }) {
  const navegar = useNavigate();
  const { marca } = useInspecao();
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  // Troca de tela numa SPA não avisa o leitor de tela: leva o foco ao título.
  useEffect(() => {
    const titulo = principal.current?.querySelector('h1');
    if (titulo) {
      titulo.setAttribute('tabindex', '-1');
      titulo.focus({ preventScroll: true });
    }
  }, [pathname]);
  return (
    <div className="tela">
      <header className="topo">
        {props.voltarPara ? (
          <button className="topo__voltar" aria-label="Voltar" onClick={() => navegar(props.voltarPara!)}>
            <Icone nome="voltar" />
          </button>
        ) : (
          <span className="topo__voltar" />
        )}
        <span className="topo__marca">
          <Icone nome="check" tamanho={18} /> {marca.nome}
        </span>
        <IndicadorSync />
      </header>
      <AvisoSemSinal />
      <main className="conteudo" ref={principal}>{props.children}</main>
      {props.rodape && <footer className="rodape">{props.rodape}</footer>}
    </div>
  );
}

/** Faixa visível sem sinal: o inspetor precisa saber que pode continuar e que nada se perde. */
function AvisoSemSinal() {
  const { online } = useEstadoFila();
  if (online) return null;
  return <p className="aviso-offline">Sem sinal. Pode continuar: tudo fica salvo no aparelho e sobe sozinho.</p>;
}

function IndicadorSync() {
  const { pendentes, online, sincronizando, ultimoErro } = useEstadoFila();
  const rotulo = !online
    ? `Sem sinal · ${pendentes} a enviar`
    : sincronizando
      ? 'Enviando…'
      : pendentes > 0
        ? `${pendentes} a enviar${ultimoErro ? ' · nova tentativa em instantes' : ''}`
        : 'Tudo enviado';
  return (
    <span
      className={`sync ${!online ? 'sync--off' : pendentes > 0 ? 'sync--pendente' : 'sync--ok'}`}
      title={rotulo}
      aria-label={rotulo}
      role="status"
    >
      <Icone nome="nuvem" tamanho={18} />
      {pendentes > 0 && <span className="sync__num">{pendentes}</span>}
    </span>
  );
}

/** Esqueleto enquanto o banco do aparelho responde (no celular fraco leva um instante). */
export function Carregando() {
  return (
    <Moldura>
      <div className="carregando" aria-busy="true" aria-label="Carregando">
        <span className="carregando__bloco carregando__bloco--titulo" />
        <span className="carregando__bloco" />
        <span className="carregando__bloco" />
        <span className="carregando__bloco" />
      </div>
    </Moldura>
  );
}

/** Verificação que não existe neste aparelho (link antigo, dados apagados). */
export function NaoEncontrada() {
  const navegar = useNavigate();
  return (
    <Moldura rodape={<button className="botao botao--primario" onClick={() => navegar('/')}>Ir para o início</button>}>
      <h1>Verificação não encontrada</h1>
      <p className="sub">Ela não está salva neste aparelho. Volte ao início e abra a verificação pela lista.</p>
    </Moldura>
  );
}

/** A versão do checklist desta inspeção não está no aparelho (ex.: arquivada antes de baixar). */
export function ChecklistIndisponivel() {
  const navegar = useNavigate();
  return (
    <Moldura rodape={<button className="botao botao--primario" onClick={() => navegar('/')}>Ir para o início</button>}>
      <h1>Checklist indisponível neste aparelho</h1>
      <p className="sub">
        A versão do checklist desta inspeção não está salva aqui. Conecte-se à internet e sincronize para continuar.
        Suas respostas já registradas não foram perdidas.
      </p>
    </Moldura>
  );
}

/** "Ford Ranger" a partir do cadastro; cai na descrição se faltar fabricante/modelo. */
export function nomeVeiculo(v: Veiculo): string {
  const fm = [v.fabricante, v.modelo].filter(Boolean).join(' ');
  return fm || v.descricao;
}

export function SeloDemo({ veiculo }: { veiculo: Veiculo }) {
  if (!veiculo.demo) return null;
  return (
    <span className="selo-demo" title="Cadastro de demonstração">
      DEMO
    </span>
  );
}

export function BarraProgresso({ valor, total }: { valor: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((valor / total) * 100);
  return (
    <div
      className="progresso"
      role="progressbar"
      aria-label={`${valor} de ${total} itens respondidos`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
    >
      <div className="progresso__barra" style={{ width: `${pct}%` }} />
    </div>
  );
}
