import type { Area, Atividade, DefinicaoAtributo, TipoVeiculo, Unidade, UsuarioAdmin, Veiculo } from "@checkvale/shared";
import { atributosDoTipo, CamposAtributos } from "../componentes/CamposAtributos";
import { useRecurso } from "./api";
import { Cadastro, Selo, type Opcao } from "./Cadastro";

const ativoSelo = (ativo: boolean) => (ativo ? <Selo tom="ok">Ativo</Selo> : <Selo tom="off">Inativo</Selo>);
const nomeDemo = (nome: string, demo: boolean) => (
  <span>{nome} {demo && <Selo tom="demo">DEMO</Selo>}</span>
);

export function PaginaOperacao() {
  const unidades = useRecurso<Unidade[]>("/admin/unidades").dados ?? [];
  const opUnidades: Opcao[] = unidades.map((u) => ({ valor: u.id, rotulo: u.nome }));
  return (
    <div className="space-y-6">
      <Cadastro<Unidade>
        titulo="Sites / complexos"
        caminho="/admin/unidades"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ nome: "", uf: null, ativo: true, demo: false })}
        colunas={[{ titulo: "Nome", render: (v) => nomeDemo(v.nome, v.demo) }, { titulo: "UF", render: (v) => v.uf ?? "—" }, { titulo: "Status", render: (v) => ativoSelo(v.ativo) }]}
        campos={[{ tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true }, { tipo: "texto", nome: "uf", rotulo: "UF (opcional)" }, { tipo: "booleano", nome: "ativo", rotulo: "Ativo" }]}
        preparar={(v) => ({ ...v, uf: v.uf ? String(v.uf).toUpperCase().slice(0, 2) : null })}
      />
      <Cadastro<Area>
        titulo="Áreas de atuação"
        caminho="/admin/areas"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ nome: "", unidadeId: null, ativo: true, demo: false })}
        colunas={[
          { titulo: "Nome", render: (v) => nomeDemo(v.nome, v.demo) },
          { titulo: "Site", render: (v) => unidades.find((u) => u.id === v.unidadeId)?.nome ?? "Todos" },
          { titulo: "Status", render: (v) => ativoSelo(v.ativo) },
        ]}
        campos={[
          { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
          { tipo: "selecao", nome: "unidadeId", rotulo: "Site", opcoes: opUnidades, vazio: "Todos os sites" },
          { tipo: "booleano", nome: "ativo", rotulo: "Ativa" },
        ]}
      />
      <Cadastro<Atividade>
        titulo="Atividades"
        caminho="/admin/atividades"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ nome: "", ativo: true, demo: false })}
        colunas={[{ titulo: "Nome", render: (v) => nomeDemo(v.nome, v.demo) }, { titulo: "Status", render: (v) => ativoSelo(v.ativo) }]}
        campos={[{ tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true }, { tipo: "booleano", nome: "ativo", rotulo: "Ativa" }]}
      />
    </div>
  );
}

export function PaginaFrota() {
  const tipos = useRecurso<TipoVeiculo[]>("/admin/tipos-veiculo").dados ?? [];
  const atributos = useRecurso<DefinicaoAtributo[]>("/admin/atributos").dados ?? [];
  const opTipos: Opcao[] = tipos.map((t) => ({ valor: t.id, rotulo: t.nome }));
  const nomeTipo = (id: string) => tipos.find((t) => t.id === id)?.nome ?? "—";
  return (
    <div className="space-y-6">
      <Cadastro<Veiculo>
        titulo="Veículos"
        caminho="/admin/veiculos"
        filtroAtivo={(v) => v.status === "ativo"}
        novo={() => ({ placa: null, codigo: null, tipoVeiculoId: "", fabricante: "", modelo: "", descricao: "", empresa: null, unidadeId: null, status: "ativo", atributos: {}, demo: false, criadoEm: "", atualizadoEm: "" })}
        colunas={[
          { titulo: "Placa / código", render: (v) => <span className="font-semibold">{v.placa ?? v.codigo} {v.demo && <Selo tom="demo">DEMO</Selo>}</span> },
          { titulo: "Tipo", render: (v) => nomeTipo(v.tipoVeiculoId) },
          { titulo: "Fabricante / modelo", render: (v) => [v.fabricante, v.modelo].filter(Boolean).join(" ") || "—" },
          { titulo: "Empresa", render: (v) => v.empresa ?? "—" },
          { titulo: "Atributos", render: (v) => <span className="text-xs text-texto-suave">{Object.entries(v.atributos).map(([k, x]) => `${atributos.find((a) => a.codigo === k)?.nome ?? k}: ${x === true ? "sim" : x === false ? "não" : x}`).join(" · ") || "—"}</span> },
          { titulo: "Status", render: (v) => ativoSelo(v.status === "ativo") },
        ]}
        campos={[
          { tipo: "selecao", nome: "tipoVeiculoId", rotulo: "Tipo de veículo *", opcoes: opTipos },
          { tipo: "texto", nome: "placa", rotulo: "Placa", ajuda: "Placa ou código interno: pelo menos um." },
          { tipo: "texto", nome: "codigo", rotulo: "Código interno" },
          { tipo: "texto", nome: "fabricante", rotulo: "Fabricante" },
          { tipo: "texto", nome: "modelo", rotulo: "Modelo" },
          { tipo: "texto", nome: "descricao", rotulo: "Descrição" },
          { tipo: "texto", nome: "empresa", rotulo: "Empresa" },
          { tipo: "selecao", nome: "status", rotulo: "Status", opcoes: [{ valor: "ativo", rotulo: "Ativo" }, { valor: "inativo", rotulo: "Inativo" }] },
          {
            tipo: "custom", nome: "atributos",
            render: (v, mudar) => (
              <div className="space-y-4 rounded-lg bg-fundo p-3">
                <p className="text-sm font-semibold">Atributos técnicos</p>
                {v.tipoVeiculoId ? (
                  <CamposAtributos defs={atributosDoTipo(atributos, v.tipoVeiculoId)} valores={v.atributos ?? {}} onChange={(a) => mudar({ atributos: a })} />
                ) : (
                  <p className="text-sm text-texto-suave">Escolha o tipo de veículo.</p>
                )}
              </div>
            ),
          },
        ]}
        preparar={(v) => ({ ...v, placa: v.placa || null, codigo: v.codigo || null, empresa: v.empresa || null })}
      />
      <Cadastro<DefinicaoAtributo>
        titulo="Atributos técnicos"
        descricao="Campos extras do veículo, usados nas regras dos checklists. O código não muda depois de criado."
        caminho="/admin/atributos"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ codigo: "", nome: "", tipo: "texto", opcoes: [], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: atributos.length + 1, ativo: true })}
        colunas={[
          { titulo: "Nome", render: (v) => v.nome },
          { titulo: "Código", render: (v) => <code className="text-xs">{v.codigo}</code> },
          { titulo: "Tipo", render: (v) => (v.tipo === "lista" ? `lista: ${v.opcoes.join(", ")}` : v.tipo) },
          { titulo: "Vale para", render: (v) => (v.tipoVeiculoIds.length ? v.tipoVeiculoIds.map(nomeTipo).join(", ") : "Todos") },
          { titulo: "Status", render: (v) => ativoSelo(v.ativo) },
        ]}
        campos={[
          { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
          { tipo: "texto", nome: "codigo", rotulo: "Código", obrigatorio: true, ajuda: "Minúsculas, números e _ (ex.: tipo_freio).", somenteNaCriacao: true },
          { tipo: "selecao", nome: "tipo", rotulo: "Tipo", somenteNaCriacao: true, opcoes: [
            { valor: "texto", rotulo: "Texto" }, { valor: "numero", rotulo: "Número" }, { valor: "booleano", rotulo: "Sim/Não" }, { valor: "lista", rotulo: "Lista de opções" },
          ] },
          { tipo: "lista", nome: "opcoes", rotulo: "Opções (tipo lista)" },
          { tipo: "texto", nome: "unidadeMedida", rotulo: "Unidade de medida (opcional)" },
          { tipo: "multipla", nome: "tipoVeiculoIds", rotulo: "Vale para os tipos", opcoes: opTipos, ajuda: "Nenhum marcado = todos os tipos." },
          { tipo: "numero", nome: "ordem", rotulo: "Ordem" },
          { tipo: "booleano", nome: "obrigatorio", rotulo: "Obrigatório no cadastro" },
          { tipo: "booleano", nome: "ativo", rotulo: "Ativo" },
        ]}
        preparar={(v, criando) => {
          const { codigo, tipo, ...resto } = v;
          return criando ? { ...resto, codigo, tipo, unidadeMedida: v.unidadeMedida || null } : { ...resto, unidadeMedida: v.unidadeMedida || null };
        }}
      />
      <Cadastro<TipoVeiculo>
        titulo="Tipos de veículo"
        caminho="/admin/tipos-veiculo"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ codigo: "", nome: "", ordem: tipos.length + 1, ativo: true })}
        colunas={[{ titulo: "Nome", render: (v) => v.nome }, { titulo: "Código", render: (v) => <code className="text-xs">{v.codigo}</code> }, { titulo: "Ordem", render: (v) => v.ordem }, { titulo: "Status", render: (v) => ativoSelo(v.ativo) }]}
        campos={[
          { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
          { tipo: "texto", nome: "codigo", rotulo: "Código", obrigatorio: true, somenteNaCriacao: true },
          { tipo: "numero", nome: "ordem", rotulo: "Ordem" },
          { tipo: "booleano", nome: "ativo", rotulo: "Ativo" },
        ]}
        preparar={(v, criando) => {
          const { codigo, ...resto } = v;
          return criando ? { ...resto, codigo } : resto;
        }}
      />
    </div>
  );
}

export function PaginaUsuarios() {
  return (
    <Cadastro<UsuarioAdmin & { senha?: string }>
      titulo="Usuários"
      descricao="ADMIN configura o sistema; INSPETOR executa o checklist."
      caminho="/admin/usuarios"
      filtroAtivo={(v) => v.ativo}
      novo={() => ({ nome: "", email: "", papel: "inspetor", ativo: true, demo: false, senha: "" })}
      colunas={[
        { titulo: "Nome", render: (v) => nomeDemo(v.nome, v.demo) },
        { titulo: "E-mail", render: (v) => v.email },
        { titulo: "Perfil", render: (v) => (v.papel === "admin" ? "Admin" : "Inspetor") },
        { titulo: "Status", render: (v) => ativoSelo(v.ativo) },
      ]}
      campos={[
        { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
        { tipo: "texto", nome: "email", rotulo: "E-mail", obrigatorio: true },
        { tipo: "selecao", nome: "papel", rotulo: "Perfil", opcoes: [{ valor: "inspetor", rotulo: "Inspetor" }, { valor: "admin", rotulo: "Admin" }] },
        { tipo: "texto", nome: "senha", rotulo: "Senha", ajuda: "Na edição, preencha só para trocar. Mínimo 8 caracteres." },
        { tipo: "booleano", nome: "ativo", rotulo: "Ativo" },
      ]}
      preparar={(v) => {
        const { senha, ...resto } = v;
        return senha ? { ...resto, senha } : resto;
      }}
    />
  );
}
