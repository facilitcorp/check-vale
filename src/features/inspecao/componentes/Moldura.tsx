import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstadoFila, useInspecao } from '../contexto';
import { Icone } from './Icone';

/** Cabeçalho verde com a marca, voltar e o estado da sincronização. */
export function Moldura(props: { voltarPara?: string; children: ReactNode; rodape?: ReactNode }) {
  const navegar = useNavigate();
  const { marca } = useInspecao();
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
      <main className="conteudo">{props.children}</main>
      {props.rodape && <footer className="rodape">{props.rodape}</footer>}
    </div>
  );
}

function IndicadorSync() {
  const { pendentes, online, sincronizando } = useEstadoFila();
  const rotulo = !online
    ? `Sem sinal · ${pendentes} a enviar`
    : sincronizando
      ? 'Enviando…'
      : pendentes > 0
        ? `${pendentes} a enviar`
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

export function BarraProgresso({ valor, total }: { valor: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((valor / total) * 100);
  return (
    <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={valor}>
      <div className="progresso__barra" style={{ width: `${pct}%` }} />
    </div>
  );
}
