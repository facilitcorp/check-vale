import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Botao, Cabecalho, Campo, Rotulo, Selecao, Tela } from "../componentes/ui";
import { useCatalogo } from "../dados/ganchos";
import { repositorioVeiculo } from "../dados/repositorio";

/** Cadastro rápido de veículo (funciona offline; sobe pela fila de sync). */
export function CadastroVeiculo() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const catalogo = useCatalogo();
  const [tipoVeiculoId, setTipo] = useState("");
  const [placa, setPlaca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const placaValida = !placa || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const pronto = tipoVeiculoId && (placa || codigo) && descricao.trim() && placaValida;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await repositorioVeiculo.salvar({
        tipoVeiculoId, placa: placa || null, codigo: codigo.trim() || null, descricao: descricao.trim(), marcaModelo: marcaModelo.trim(),
        unidadeId: params.get("unidadeId") || null,
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
              <Rotulo htmlFor="tipo">Tipo de veículo</Rotulo>
              <Selecao id="tipo" value={tipoVeiculoId} onChange={(e) => setTipo(e.target.value)}>
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
              <Rotulo htmlFor="codigo">Código interno / frota (opcional se houver placa)</Rotulo>
              <Campo id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div>
              <Rotulo htmlFor="descricao">Descrição</Rotulo>
              <Campo id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Caminhonete" />
            </div>
            <div>
              <Rotulo htmlFor="modelo">Marca e modelo</Rotulo>
              <Campo id="modelo" value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} placeholder="Ford Ranger" />
            </div>
            {erro && <Aviso tom="erro">{erro}</Aviso>}
          </div>
        </Tela>
      </form>
    </>
  );
}
