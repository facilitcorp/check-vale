import { pode } from "@checkvale/shared";
import { ClipboardList, Cog, LogOut, Smartphone, Truck, Users } from "lucide-react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { Logo } from "../componentes/ui";
import { sair, useSessao } from "../dados/sessao";

const MENU = [
  { para: "/admin/modelos", rotulo: "Checklists", icone: ClipboardList },
  { para: "/admin/operacao", rotulo: "Operação", icone: Cog },
  { para: "/admin/frota", rotulo: "Frota", icone: Truck },
  { para: "/admin/usuarios", rotulo: "Usuários", icone: Users },
];

/** Área administrativa (desktop-first, funciona no celular). Exige permissão config:ler. */
export function LayoutAdmin() {
  const { usuario } = useSessao();
  if (!usuario || !pode(usuario.papel, "config:ler")) return <Navigate to="/" replace />;
  return (
    <div className="min-h-dvh bg-fundo">
      <header className="sticky top-0 z-10 bg-marca text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Logo claro />
          <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-semibold">ADMIN</span>
          <nav className="ml-2 hidden gap-1 md:flex">
            {MENU.map((m) => (
              <NavLink key={m.para} to={m.para} className={({ isActive }) => `flex items-center gap-1.5 min-h-11 rounded-lg px-3 text-sm ${isActive ? "bg-white/20" : "hover:bg-white/10"}`}>
                <m.icone size={16} /> {m.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <NavLink to="/" className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm hover:bg-white/10" title="App do inspetor"><Smartphone size={16} /><span className="hidden sm:inline">App</span></NavLink>
          <button aria-label="Sair" onClick={() => void sair()} className="flex size-11 items-center justify-center rounded-lg hover:bg-white/10"><LogOut size={18} /></button>
        </div>
        {/* No celular, as abas dividem a largura: nenhuma fica escondida atrás de rolagem. */}
        <nav className="grid grid-cols-4 gap-1 px-2 pb-2 md:hidden">
          {MENU.map((m) => (
            <NavLink key={m.para} to={m.para} className={({ isActive }) => `flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs ${isActive ? "bg-white/20" : ""}`}>
              <m.icone size={18} /> <span className="max-w-full truncate">{m.rotulo}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
