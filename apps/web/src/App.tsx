import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { carregarSessao, useSessao } from "./dados/sessao";
import { iniciarSincronizacao } from "./dados/sincronizacao";
import { LayoutAdmin } from "./admin/LayoutAdmin";
import { PaginaFrota, PaginaOperacao, PaginaUsuarios } from "./admin/PaginasCadastro";
import { EditorVersao, PaginaModelos } from "./admin/PaginaModelos";
import { PaginaBiblioteca, PaginaModeloBiblioteca, PaginaSetorBiblioteca, PaginaSetores } from "./admin/Biblioteca";
import { Abertura } from "./telas/Abertura";
import { CadastroVeiculo } from "./telas/CadastroVeiculo";
import { Entrar } from "./telas/Entrar";
import { telasDaInspecao } from "./inspecao";
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
        <Route path="/cadastro" element={usuario ? <Navigate to="/" replace /> : <Entrar modo="cadastro" />} />
        <Route path="/nova" element={<Protegida><NovaVerificacao /></Protegida>} />
        <Route path="/nova/veiculo" element={<Protegida><SelecionarVeiculo /></Protegida>} />
        <Route path="/veiculos/novo" element={<Protegida><CadastroVeiculo /></Protegida>} />
        {telasDaInspecao.map((t) => (
          <Route key={t.caminho} path={t.caminho} element={<Protegida>{t.elemento}</Protegida>} />
        ))}
        <Route path="/admin" element={<Protegida><LayoutAdmin /></Protegida>}>
          <Route index element={<Navigate to="modelos" replace />} />
          <Route path="modelos" element={<PaginaModelos />} />
          <Route path="modelos/:id/v/:v" element={<EditorVersao />} />
          <Route path="biblioteca" element={<PaginaBiblioteca />} />
          <Route path="biblioteca/modelo/:id" element={<PaginaModeloBiblioteca />} />
          <Route path="biblioteca/:setorId" element={<PaginaSetorBiblioteca />} />
          <Route path="setores" element={<PaginaSetores />} />
          <Route path="operacao" element={<PaginaOperacao />} />
          <Route path="frota" element={<PaginaFrota />} />
          <Route path="usuarios" element={<PaginaUsuarios />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
