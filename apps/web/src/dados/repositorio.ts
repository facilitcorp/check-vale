import { Resposta as RespostaSchema, type Evidencia, type Inspecao, type Resposta, type Veiculo } from "@checkvale/shared";
import { banco } from "./banco";
import { comprimirFoto } from "../lib/imagem";
import { enfileirar } from "./fila";

/**
 * Única porta de escrita das telas. Tudo grava primeiro no aparelho
 * (IndexedDB) e empilha a operação de sync — funciona igual com ou sem rede.
 * As telas NUNCA chamam a API diretamente para gravar.
 */
export interface NovaInspecao {
  modeloId: string;
  modeloVersao: number;
  unidadeId: string;
  areaId: string;
  atividadeId: string;
  veiculoId: string;
  inspetorId: string;
}

const agora = () => new Date().toISOString();

async function exigir(id: string): Promise<Inspecao> {
  const i = await banco.inspecoes.get(id);
  if (!i) throw new Error("Inspeção não encontrada neste aparelho.");
  return i;
}

async function gravar(i: Inspecao): Promise<Inspecao> {
  await banco.inspecoes.put(i);
  await enfileirar({ tipo: "inspecao.salvar", inspecao: i });
  return i;
}

export const repositorioInspecao = {
  async criar(dados: NovaInspecao): Promise<Inspecao> {
    return gravar({ id: crypto.randomUUID(), ...dados, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null, respostas: [] });
  },

  obter: (id: string) => banco.inspecoes.get(id),

  /** Inspeções deste aparelho, mais recentes primeiro. */
  listar: () => banco.inspecoes.orderBy("iniciadaEm").reverse().toArray(),

  /** Grava (ou troca) a resposta de um item. Valida as regras do contrato (NC exige descrição e foto). */
  async salvarResposta(inspecaoId: string, resposta: Omit<Resposta, "respondidaEm">): Promise<Inspecao> {
    const i = await exigir(inspecaoId);
    if (i.status !== "em_andamento") throw new Error("Inspeção já finalizada.");
    const nova = RespostaSchema.parse({ ...resposta, respondidaEm: agora() });
    return gravar({ ...i, respostas: [...i.respostas.filter((r) => r.itemId !== nova.itemId), nova] });
  },

  /** Comprime, guarda a foto no aparelho e registra os metadados. Devolve a evidência para usar em evidenciaIds. */
  async adicionarEvidencia(inspecaoId: string, itemId: string, original: Blob): Promise<Evidencia> {
    const arquivo = await comprimirFoto(original);
    const mime = arquivo.type as Evidencia["mime"];
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("Formato de imagem não suportado.");
    const evidencia: Evidencia = { id: crypto.randomUUID(), inspecaoId, itemId, mime, bytes: arquivo.size, capturadaEm: agora(), url: null };
    await banco.evidencias.put({ ...evidencia, arquivo, enviada: false });
    await enfileirar({ tipo: "evidencia.registrar", evidencia });
    return evidencia;
  },

  /** Blob local da foto (para miniatura). */
  async arquivoEvidencia(id: string): Promise<Blob | null> {
    return (await banco.evidencias.get(id))?.arquivo ?? null;
  },

  async concluir(inspecaoId: string): Promise<Inspecao> {
    const i = await exigir(inspecaoId);
    if (i.status !== "em_andamento") return i;
    return gravar({ ...i, status: "concluida", concluidaEm: agora() });
  },
};

export type RepositorioInspecao = typeof repositorioInspecao;

export const repositorioVeiculo = {
  listar: () => banco.veiculos.toArray(),
  obter: (id: string) => banco.veiculos.get(id),

  /** Cadastro feito no app (inclusive offline). Placa normalizada em maiúsculas, sem traço. */
  async salvar(dados: Omit<Veiculo, "id" | "criadoEm" | "atualizadoEm"> & { id?: string }): Promise<Veiculo> {
    const placa = dados.placa ? dados.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") : null;
    if (placa) {
      const outro = await banco.veiculos.where("placa").equals(placa).first();
      if (outro && outro.id !== dados.id) throw new Error(`Placa ${placa} já cadastrada.`);
    }
    const existente = dados.id ? await banco.veiculos.get(dados.id) : undefined;
    const v: Veiculo = {
      ...dados,
      id: dados.id ?? crypto.randomUUID(),
      placa,
      criadoEm: existente?.criadoEm ?? agora(),
      atualizadoEm: agora(),
    };
    await banco.veiculos.put(v);
    await enfileirar({ tipo: "veiculo.salvar", veiculo: v });
    return v;
  },
};
