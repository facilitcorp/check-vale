/**
 * SOMENTE TESTE. Monta o aparelho como a fundação deixa depois do login e do
 * primeiro sync (catálogo, modelo, veículo) e um servidor falso no fetch.
 */
import { vi } from 'vitest';
import { SEM_RESTRICAO, type Catalogo, type EvidenciaItem, type ModeloChecklist, type OperacaoSync, type SyncEntrada, type Veiculo } from '@checkvale/shared';
import { banco, chaveModelo } from '../dados/banco';
import { repositorioInspecao } from '../dados/repositorio';

const uid = () => crypto.randomUUID();
const agora = () => new Date().toISOString();

export const TIPO_LEVE = uid();
const TIPO_PESADO = uid();

const CATEGORIAS: [nome: string, icone: string, itens: string[], soPesado?: boolean][] = [
  ['Identificação do veículo', 'id-card', ['Placa legível e íntegra', 'Chassi confere com documento', 'Adesivo de identificação da operação']],
  ['Iluminação e sinalização', 'light', [
    'Faróis baixo e alto', 'Lanternas traseiras', 'Luz de freio', 'Setas e pisca-alerta',
    'Luz de ré e alarme sonoro', 'Giroflex', 'Iluminação lateral',
  ]],
  ['Documentação', 'document', ['CRLV em dia', 'Seguro obrigatório', 'Autorização de tráfego interno']],
  // regra real de aplicabilidade: só veículo pesado tem telemetria
  ['Telemetria e tecnologia', 'satellite', ['Rastreador ativo', 'Câmera de fadiga'], true],
];

/** Itens com evidência configurada; os demais ficam sem o campo (regra de sempre). */
const EVIDENCIAS: Record<string, EvidenciaItem> = { 'CRLV em dia': 'foto', 'Seguro obrigatório': 'observacao' };

export const MODELO: ModeloChecklist = {
  id: uid(),
  nome: 'Mobilização',
  versao: 1,
  aplicavel: SEM_RESTRICAO,
  categorias: CATEGORIAS.map(([nome, icone, itens, soPesado], ci) => ({
    id: uid(),
    codigo: `c${ci}`,
    nome,
    icone,
    ordem: ci + 1,
    aplicavel: soPesado ? { ...SEM_RESTRICAO, tipoVeiculoIds: [TIPO_PESADO] } : SEM_RESTRICAO,
    itens: itens.map((titulo, ii) => ({
      id: uid(),
      codigo: `c${ci}i${ii}`,
      titulo,
      descricao: '',
      ordem: ii + 1,
      permiteNaoAplica: true,
      criticidadeSugerida: null,
      aplicavel: SEM_RESTRICAO,
      ...(EVIDENCIAS[titulo] ? { evidencia: EVIDENCIAS[titulo] } : {}),
    })),
  })),
};

/** Itens que o veículo leve responde (sem telemetria). */
export const ITENS_LEVE = MODELO.categorias.filter((c) => c.aplicavel.tipoVeiculoIds.length === 0).flatMap((c) => c.itens);
export const item = (titulo: string) => MODELO.categorias.flatMap((c) => c.itens).find((i) => i.titulo === titulo)!;

const CATALOGO: Catalogo = {
  versao: '1',
  unidades: [{ id: uid(), nome: 'Carajás' } as Catalogo['unidades'][number]],
  areas: [{ id: uid(), nome: 'Operacional' } as Catalogo['areas'][number]],
  atividades: [{ id: uid(), nome: 'Transporte' } as Catalogo['atividades'][number]],
  tiposVeiculo: [],
  atributos: [],
  modelos: [MODELO],
};

/** Servidor falso: aplica tudo e guarda o que recebeu. falhar = 500 em /sync. */
export function servidorFalso() {
  const s = { recebidas: [] as OperacaoSync[], falhar: false };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
      if (url === '/api/sync') {
        if (s.falhar) return json({ erro: 'interno', mensagem: 'Falha no servidor.' }, 500);
        const e = JSON.parse(init!.body as string) as SyncEntrada;
        s.recebidas.push(...e.operacoes);
        return json({ resultados: e.operacoes.map((o) => ({ opId: o.opId, status: 'aplicada', erro: null })), servidorEm: agora() });
      }
      if (url.startsWith('/api/evidencias/')) return json({ url });
      if (url.startsWith('/api/catalogo')) return new Response(null, { status: 304 });
      if (url.startsWith('/api/veiculos')) return json({ veiculos: [], servidorEm: agora() });
      if (url.startsWith('/api/inspecoes')) return json({ inspecoes: [], servidorEm: agora() });
      return json({}, 404);
    }),
  );
  return s;
}

export async function prepararAparelho() {
  await Promise.all(banco.tables.map((t) => t.clear()));
  await banco.catalogo.put({ chave: 'atual', catalogo: CATALOGO });
  await banco.modelos.put({ ...MODELO, chave: chaveModelo(MODELO.id, MODELO.versao) });
}

export async function novaInspecao(placa = 'OWQ3A15', demo = false) {
  const veiculo: Veiculo = {
    id: uid(), placa, codigo: null, tipoVeiculoId: TIPO_LEVE, fabricante: 'Ford', modelo: 'Ranger', descricao: 'Caminhonete',
    empresa: null, unidadeId: null, status: 'ativo', atributos: {}, demo, criadoEm: agora(), atualizadoEm: agora(),
  };
  await banco.veiculos.put(veiculo);
  return repositorioInspecao.criar({
    modeloId: MODELO.id,
    modeloVersao: MODELO.versao,
    unidadeId: CATALOGO.unidades[0]!.id,
    areaId: CATALOGO.areas[0]!.id,
    atividadeId: CATALOGO.atividades[0]!.id,
    veiculoId: veiculo.id,
    inspetorId: uid(),
    tipoVeiculoId: veiculo.tipoVeiculoId,
    atributosVeiculo: {},
  });
}

const foto = () => new Blob(['x'], { type: 'image/jpeg' });

/** Responde direto pelo repositório da fundação (atalho de teste). */
/** Responde cumprindo a evidência que o item pede (foto/observação), como o app exige. */
export async function responder(inspecaoId: string, itemId: string, status: 'conforme' | 'nao_aplica') {
  const ev = status === 'conforme' ? MODELO.categorias.flatMap((c) => c.itens).find((i) => i.id === itemId)?.evidencia : undefined;
  const evidenciaIds = ev === 'foto' ? [(await repositorioInspecao.adicionarEvidencia(inspecaoId, itemId, foto())).id] : [];
  const observacao = ev === 'observacao' ? 'Verificado.' : null;
  await repositorioInspecao.salvarResposta(inspecaoId, { itemId, status, observacao, naoConformidade: null, evidenciaIds });
}
export async function responderNc(inspecaoId: string, itemId: string, descricao: string, criticidade: 'critica' | 'alta' | 'media' | 'baixa') {
  const e = await repositorioInspecao.adicionarEvidencia(inspecaoId, itemId, foto());
  await repositorioInspecao.salvarResposta(inspecaoId, {
    itemId, status: 'nao_conforme', observacao: null, naoConformidade: { descricao, criticidade }, evidenciaIds: [e.id],
  });
}
export async function concluirTudo(inspecaoId: string) {
  for (const i of ITENS_LEVE) await responder(inspecaoId, i.id, 'conforme');
  await repositorioInspecao.concluir(inspecaoId);
}
