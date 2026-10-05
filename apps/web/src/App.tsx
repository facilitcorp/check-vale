import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { carregarSessao, useSessao } from "./dados/sessao";
import { iniciarSincronizacao } from "./dados/sincronizacao";
import { Abertura } from "./telas/Abertura";
import { CadastroVeiculo } from "./telas/CadastroVeiculo";
import { ChecklistProvisorio } from "./telas/ChecklistProvisorio";
import { Entrar } from "./telas/Entrar";
import { Inicio } from "./telas/Inicio";
import { NovaVerificacao } from "./telas/NovaVerificacao";
import { SelecionarVeiculo } from "./telas/SelecionarVeiculo";

function Protegida({ children }: { children: ReactNode }) {
  const { usuario } = useSessao();
  useEffect(() => (usuario ? iniciarSincronizacao() : undefined), [usuario]);
  return usuario ? children : <Navigate to="/entrar" replace />;
}

export function App() {
  const { usuario, carregada } = useSessao();
  useEffect(() => void carregarSessao(), []);
  if (!carregada) return <Abertura />;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={usuario ? <Navigate to="/" replace /> : <Entrar />} />
        <Route path="/" element={<Protegida><Inicio /></Protegida>} />
        <Route path="/nova" element={<Protegida><NovaVerificacao /></Protegida>} />
        <Route path="/nova/veiculo" element={<Protegida><SelecionarVeiculo /></Protegida>} />
        <Route path="/veiculos/novo" element={<Protegida><CadastroVeiculo /></Protegida>} />
        <Route path="/inspecao/:id/*" element={<Protegida><ChecklistProvisorio /></Protegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
