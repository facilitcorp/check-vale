import { ArrowLeft, ChevronDown, CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { observarSync, type EstadoSync } from "../dados/sincronizacao";
import { MARCA } from "../marca";

/**
 * Componentes base do CheckVale (mobile-first, padrão do mockup).
 * Cores só por token (bg-marca, text-texto-suave...). Ver estilos.css.
 */

/** Logotipo em SVG (marca é imagem: nome acessível único, sem cálculo de contraste de texto). */
export function Logo({ claro = false, tamanho = "md" }: { claro?: boolean; tamanho?: "md" | "lg" | "xl" }) {
  const fonte = { md: 18, lg: 30, xl: 48 }[tamanho];
  const corte = MARCA.nome.endsWith(MARCA.nomeDestaque) ? MARCA.nome.length - MARCA.nomeDestaque.length : MARCA.nome.length;
  const [inicio, destaque] = [MARCA.nome.slice(0, corte), MARCA.nome.slice(corte)];
  const icone = fonte * 1.25;
  const largura = icone + fonte * 0.3 + MARCA.nome.length * fonte * 0.6;
  return (
    <svg role="img" aria-label={MARCA.nome} height={fonte * 1.4} viewBox={`0 0 ${largura} ${fonte * 1.4}`} className="inline-block">
      <path
        transform={`translate(0 ${fonte * 0.08}) scale(${icone / 64})`}
        d="M10 34l14 14 30-34"
        fill="none"
        stroke={claro ? "#fff" : "var(--color-marca)"}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={icone + fonte * 0.3} y={fonte * 1.08} fontSize={fonte} fontWeight={700} fontFamily="var(--font-sans)" letterSpacing="-0.02em">
        <tspan fill={claro ? "#fff" : "var(--color-marca)"}>{inicio}</tspan>
        <tspan fill="var(--color-destaque)">{destaque}</tspan>
      </text>
    </svg>
  );
}

export function IndicadorSync() {
  const [e, setE] = useState<EstadoSync | null>(null);
  useEffect(() => observarSync(setE), []);
  if (!e) return null;
  if (!e.online)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/90" title={`${e.pendentes} pendente(s)`}>
        <CloudOff size={14} /> Offline{e.pendentes ? ` · ${e.pendentes}` : ""}
      </span>
    );
  if (e.sincronizando || e.pendentes)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/90">
        <RefreshCw size={14} className={e.sincronizando ? "animate-spin" : ""} /> {e.pendentes || ""}
      </span>
    );
  return null;
}

/** Barra verde do topo (telas internas). */
export function Cabecalho({ voltar = true, direita }: { voltar?: boolean | string; direita?: ReactNode }) {
  const navegar = useNavigate();
  return (
    <header className="sticky top-0 z-10 bg-marca pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex h-14 max-w-md items-center px-3">
        <div className="w-20">
          {voltar && (
            <button
              aria-label="Voltar"
              className="-ml-1 flex size-11 items-center justify-center rounded-full active:bg-white/10"
              onClick={() => (typeof voltar === "string" ? navegar(voltar) : navegar(-1))}
            >
              <ArrowLeft size={22} />
            </button>
          )}
        </div>
        <div className="flex flex-1 justify-center">
          <Logo claro />
        </div>
        <div className="flex w-20 justify-end whitespace-nowrap">{direita ?? <IndicadorSync />}</div>
      </div>
    </header>
  );
}

/** Corpo da tela: cartão branco com cantos arredondados sobre o fundo, rodapé fixo opcional. */
export function Tela({ titulo, subtitulo, children, rodape }: { titulo?: string; subtitulo?: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col bg-superficie">
      <div className="flex-1 px-5 pb-6 pt-5">
        {titulo && <h1 className="text-xl font-bold text-texto">{titulo}</h1>}
        {subtitulo && <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>}
        <div className={titulo ? "mt-5" : ""}>{children}</div>
      </div>
      {rodape && <div className="sticky bottom-0 border-t border-borda bg-superficie px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{rodape}</div>}
    </main>
  );
}

type Variante = "primario" | "secundario" | "fantasma";
export function Botao({ variante = "primario", className = "", carregando, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const v: Record<Variante, string> = {
    primario: "bg-marca text-white active:bg-marca-escura disabled:bg-neutro/40",
    secundario: "border border-marca text-marca bg-superficie active:bg-marca-clara disabled:opacity-50",
    fantasma: "text-marca active:bg-marca-clara",
  };
  return (
    <button {...p} disabled={p.disabled || carregando} className={`h-12 w-full rounded-lg px-4 text-base font-semibold transition ${v[variante]} ${className}`}>
      {carregando ? "Aguarde..." : children}
    </button>
  );
}

export function Rotulo({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-texto">
      {children}
    </label>
  );
}

export function Campo(p: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`h-12 w-full rounded-lg border border-borda bg-superficie px-3 text-base text-texto placeholder:text-neutro focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20 ${p.className ?? ""}`}
    />
  );
}

export function Selecao({ icone, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { icone?: ReactNode }) {
  return (
    <div className="relative">
      {icone && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca">{icone}</span>}
      <select
        {...p}
        className={`h-12 w-full appearance-none rounded-lg border border-borda bg-superficie pr-10 text-base text-texto focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20 ${icone ? "pl-10" : "pl-3"}`}
      >
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave" />
    </div>
  );
}

export function Aviso({ tom = "info", children }: { tom?: "info" | "erro"; children: ReactNode }) {
  const c = tom === "erro" ? "border-erro/30 bg-erro/5 text-erro" : "border-marca/20 bg-marca-clara text-texto-suave";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${c}`} role={tom === "erro" ? "alert" : undefined}>{children}</div>;
}
