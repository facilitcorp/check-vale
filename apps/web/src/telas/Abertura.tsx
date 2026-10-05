import { Logo } from "../componentes/ui";
import { MARCA } from "../marca";

/** Tela 1 — abertura, exibida enquanto a sessão local carrega. */
export function Abertura() {
  return (
    <div className="flex h-dvh flex-col justify-between bg-gradient-to-b from-marca to-marca-escura px-8 pb-10 pt-[20vh] text-white">
      <div>
        <Logo claro tamanho="xl" />
        <p className="mt-4 max-w-xs text-xl leading-snug text-white/90">{MARCA.slogan}</p>
      </div>
      {MARCA.iniciativa && <p className="text-sm text-white/80">Uma iniciativa {MARCA.iniciativa}</p>}
    </div>
  );
}
