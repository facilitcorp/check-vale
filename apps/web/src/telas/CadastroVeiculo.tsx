import { validarAtributos, type Atributos } from "@checkvale/shared";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { atributosDoTipo, CamposAtributos } from "../componentes/CamposAtributos";
import { Aviso, Botao, Cabecalho, Campo, Rotulo, Selecao, Tela } from "../componentes/ui";
import { useCatalogo } from "../dados/ganchos";
import { repositorioVeiculo } from "../dados/repositorio";

/** Cadastro rápido de veículo no campo (funciona offline; sobe pela fila de sync). */
export function CadastroVeiculo() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const catalogo = useCatalogo();
  const [tipoVeiculoId, setTipo] = useState("");
  const [placa, setPlaca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [atributos, setAtributos] = useState<Atributos>({});
  const [erro, setErro] = useState<string | null>(null);

  const defs = catalogo && tipoVeiculoId ? atributosDoTipo(catalogo.atributos, tipoVeiculoId) : [];
  const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const placaValida = !placa || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placaNorm);
  const pronto = tipoVeiculoId && (placa || codigo.trim()) && placaValida;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const errosAtrib = validarAtributos(catalogo?.atributos ?? [], tipoVeiculoId, atributos);
    if (errosAtrib.length) return setErro(errosAtrib.join(" "));
    try {
      await repositorioVeiculo.salvar({
        tipoVeiculoId, placa: placa || null, codigo: codigo.trim() || null, fabricante: fabricante.trim(), modelo: modelo.trim(),
        descricao: descricao.trim(), empresa: empresa.trim() || null, unidadeId: params.get("unidadeId") || null, status: "ativo", atributos,
      });
      navegar(-1);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <>
      <Cabecalho />
      <form onSubmit={salvar}>
        <Tela titulo="Cadastrar veículo" subtitulo="Informe a placa ou o código interno." rodape={<Botao type="submit" disabled={!pronto}>Salvar veículo</Botao>}>
          <div className="space-y-4">
            <div>
              <Rotulo htmlFor="tipo">Tipo de veículo *</Rotulo>
              <Selecao id="tipo" value={tipoVeiculoId} onChange={(e) => (setTipo(e.target.value), setAtributos({}))}>
                <option value="">Selecione</option>
                {catalogo?.tiposVeiculo.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Selecao>
            </div>
            <div>
              <Rotulo htmlFor="placa">Placa</Rotulo>
              <Campo id="placa" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" autoCapitalize="characters" maxLength={8} />
              {!placaValida && <p className="mt-1 text-sm text-erro">Placa inválida (padrão ABC1234 ou ABC1D23).</p>}
            </div>
            <div>
              <Rotulo htmlFor="codigo">Código interno (obrigatório se não houver placa)</Rotulo>
              <Campo id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Rotulo htmlFor="fabricante">Fabricante</Rotulo>
                <Campo id="fabricante" value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
              </div>
              <div>
                <Rotulo htmlFor="modelo">Modelo</Rotulo>
                <Campo id="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              </div>
            </div>
            <div>
              <Rotulo htmlFor="descricao">Descrição (opcional)</Rotulo>
              <Campo id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: caminhonete de apoio" />
            </div>
            <div>
              <Rotulo htmlFor="empresa">Empresa (opcional)</Rotulo>
              <Campo id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <CamposAtributos defs={defs} valores={atributos} onChange={setAtributos} />
            {erro && <Aviso tom="erro">{erro}</Aviso>}
          </div>
        </Tela>
      </form>
    </>
  );
}
