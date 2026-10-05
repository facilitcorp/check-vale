import { createHash } from "node:crypto";
import { SEM_RESTRICAO, type CategoriaChecklist, type Criticidade, type DefinicaoAtributo, type ModeloChecklist, type RegraAplicabilidade } from "@checkvale/shared";

/** UUID determinístico (formato v5) a partir de um nome — semente estável entre execuções. */
export function idDe(nome: string): string {
  const h = createHash("sha1").update(`checkvale:${nome}`).digest("hex");
  const v = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Dados de DEMONSTRAÇÃO (gravados com demo = true). Não representam complexos,
 * regras ou checklists oficiais: em produção tudo é cadastrado pelo ADMIN.
 */
export const UNIDADES = [{ id: idDe("unidade:demo"), nome: "Complexo DEMO", uf: null as string | null }];

export const AREAS = [
  { id: idDe("area:operacional"), nome: "Área operacional" },
  { id: idDe("area:administrativa"), nome: "Área administrativa" },
  { id: idDe("area:mina"), nome: "Mina" },
];

export const ATIVIDADES = [
  { id: idDe("atividade:transporte-pessoas"), nome: "Transporte de pessoas" },
  { id: idDe("atividade:transporte-carga"), nome: "Transporte de carga" },
  { id: idDe("atividade:apoio-operacional"), nome: "Apoio operacional" },
];

export const TIPOS_VEICULO = [
  { id: idDe("tipo:leve"), codigo: "leve", nome: "Leves", ordem: 1 },
  { id: idDe("tipo:van"), codigo: "van", nome: "Vans", ordem: 2 },
  { id: idDe("tipo:onibus"), codigo: "onibus", nome: "Ônibus", ordem: 3 },
  { id: idDe("tipo:maquina"), codigo: "maquina", nome: "Máquina", ordem: 4 },
  { id: idDe("tipo:caminhao"), codigo: "caminhao", nome: "Caminhões", ordem: 5 },
];

type ItemSemente = [titulo: string, descricao: string, criticidade?: Criticidade, permiteNaoAplica?: boolean, aplicavel?: Partial<RegraAplicabilidade>];

export const ATRIBUTOS_DEMO: Omit<DefinicaoAtributo, "id">[] = [
  { codigo: "tipo_freio", nome: "Tipo de freio", tipo: "lista", opcoes: ["Hidráulico", "Pneumático"], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: 1, ativo: true },
  { codigo: "lotacao", nome: "Lotação", tipo: "numero", opcoes: [], unidadeMedida: "passageiros", tipoVeiculoIds: [], obrigatorio: false, ordem: 2, ativo: true },
  { codigo: "possui_giroflex", nome: "Possui giroflex", tipo: "booleano", opcoes: [], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: 3, ativo: true },
];

const CATEGORIAS: [codigo: string, nome: string, icone: string, itens: ItemSemente[]][] = [
  ["identificacao", "Identificação do veículo", "id-card", [
    ["Placa dianteira e traseira", "Legíveis, fixadas e sem avarias.", "media", false],
    ["Número do chassi", "Confere com o documento do veículo.", "alta", false],
    ["Identificação da frota", "Prefixo/código visível nas laterais.", "baixa"],
    ["Adesivos de identificação da empresa", "Presentes e em bom estado.", "baixa"],
    ["Hodômetro / horímetro", "Funcionando e com leitura registrada.", "media", false],
    ["Faixas refletivas", "Instaladas conforme padrão e sem descolamento.", "media"],
  ]],
  ["externos", "Itens externos", "car", [
    ["Estado geral da carroceria", "Sem amassados, trincas ou danos estruturais.", "media", false],
    ["Para-brisa", "Sem trincas no campo de visão do motorista.", "alta", false],
    ["Retrovisores", "Completos, ajustáveis e sem trincas.", "alta", false],
    ["Limpadores e esguicho", "Palhetas em bom estado e esguicho funcionando.", "media", false],
    ["Para-choques", "Fixados e sem partes soltas.", "media"],
    ["Portas e travas", "Abrem, fecham e travam corretamente.", "alta", false],
    ["Engate / gancho de reboque", "Fixado e sem trincas.", "media"],
    ["Antena e acessórios externos", "Fixados, sem risco de queda.", "baixa"],
  ]],
  ["motor", "Motor e fluidos", "engine", [
    ["Nível de óleo do motor", "Entre mínimo e máximo, sem contaminação.", "alta", false],
    ["Nível do líquido de arrefecimento", "Dentro da faixa indicada.", "alta", false],
    ["Fluido de freio", "Nível adequado no reservatório.", "critica", false],
    ["Fluido da direção hidráulica", "Nível adequado, sem vazamentos.", "alta"],
    ["Vazamentos aparentes", "Sem vazamentos de óleo, combustível ou água.", "alta", false],
    ["Correias e mangueiras", "Sem rachaduras, folgas ou ressecamento.", "media", false],
  ]],
  ["freios", "Sistema de freios", "brake", [
    ["Freio de serviço", "Pedal firme e frenagem uniforme.", "critica", false],
    ["Freio de estacionamento", "Segura o veículo em rampa.", "critica", false],
    ["Luz de alerta de freio", "Apaga após a partida.", "alta", false],
    ["Discos, pastilhas e lonas", "Sem desgaste além do limite.", "alta", false],
    // Exemplo de regra: só aparece para veículo com freio pneumático.
    ["Sistema pneumático", "Sem vazamentos e pressão adequada.", "critica", false, { atributos: [{ atributo: "tipo_freio", operador: "igual", valor: "Pneumático" }] }],
  ]],
  ["pneus", "Pneus e rodas", "tire", [
    ["Sulco dos pneus", "Acima de 1,6 mm (TWI) em todos os pneus.", "critica", false],
    ["Calibragem", "Conforme especificação do fabricante.", "media", false],
    ["Estado lateral dos pneus", "Sem bolhas, cortes ou deformações.", "alta", false],
    ["Porcas e parafusos de roda", "Completos e com indicadores de aperto.", "critica", false],
    ["Estepe, macaco e chave de roda", "Presentes e em condição de uso.", "media"],
  ]],
  ["iluminacao", "Iluminação e sinalização", "light", [
    ["Faróis baixo e alto", "Funcionando e regulados.", "alta", false],
    ["Lanternas dianteiras e traseiras", "Funcionando, sem lentes quebradas.", "alta", false],
    ["Luz de freio", "Acendem ao frear, incluindo brake light.", "critica", false],
    ["Setas e pisca-alerta", "Funcionando nos quatro cantos.", "alta", false],
    ["Luz de ré e alarme sonoro de ré", "Acionam ao engatar a ré.", "alta", false],
    ["Giroflex / sinalizador rotativo", "Instalado e funcionando.", "media", false, { atributos: [{ atributo: "possui_giroflex", operador: "igual", valor: true }] }],
    ["Iluminação lateral", "Funcionando em toda a lateral.", "media"],
  ]],
  ["cabine", "Cabine e segurança", "shield", [
    ["Cintos de segurança", "Todos os assentos, travando corretamente.", "critica", false],
    ["Extintor de incêndio", "Carregado, lacrado e dentro da validade.", "critica", false],
    ["Kit de primeiros socorros", "Completo e dentro da validade.", "media"],
    ["Triângulo de sinalização", "Presente e em bom estado.", "media", false],
    ["Buzina", "Funcionando.", "alta", false],
    ["Bancos e encostos", "Fixados e ajustáveis.", "media", false],
  ]],
  ["telemetria", "Telemetria e tecnologia", "satellite", [
    ["Rastreador / telemetria", "Instalado e comunicando.", "alta"],
    ["Sistema de detecção de fadiga", "Instalado e calibrado.", "critica"],
    ["Câmera / videomonitoramento", "Gravando e com imagem nítida.", "media"],
    ["Sensor de estacionamento", "Instalado e funcionando.", "media"],
    ["Limitador de velocidade", "Configurado conforme a área.", "alta"],
    ["Rádio de comunicação", "Instalado e com comunicação testada.", "alta"],
  ]],
  ["area_operacional", "Itens da área operacional", "hard-hat", [
    ["Bandeira de sinalização (mastro)", "Instalada na altura exigida para a área.", "alta"],
    ["Calços de roda", "Dois calços presentes e em bom estado.", "alta"],
    ["Cones de sinalização", "Quantidade mínima presente.", "media"],
    ["Corta-corrente / chave geral", "Instalada e identificada.", "alta"],
    ["Protetor de cárter", "Instalado e fixado.", "media"],
    ["Para-barro", "Instalados e íntegros.", "baixa"],
    ["Adesivo de velocidade máxima", "Visível na traseira.", "baixa"],
    ["Kit de mitigação ambiental", "Presente e completo.", "media"],
  ]],
  ["documentacao", "Documentação", "document", [
    ["CRLV do veículo", "Válido e disponível.", "critica", false],
    ["Licença / autorização de acesso", "Válida para a unidade.", "alta", false],
    ["Registro de manutenção preventiva", "Em dia conforme plano.", "alta"],
  ]],
];

export function modeloPadrao(): ModeloChecklist {
  const categorias: CategoriaChecklist[] = CATEGORIAS.map(([codigo, nome, icone, itens], ci) => ({
    id: idDe(`categoria:${codigo}`),
    codigo,
    nome,
    icone,
    ordem: ci + 1,
    aplicavel: SEM_RESTRICAO,
    itens: itens.map(([titulo, descricao, criticidade, permiteNaoAplica, aplicavel], ii) => ({
      id: idDe(`item:${codigo}:${ii + 1}`),
      codigo: `${codigo}.${ii + 1}`,
      titulo,
      descricao,
      ordem: ii + 1,
      permiteNaoAplica: permiteNaoAplica ?? true,
      criticidadeSugerida: criticidade ?? null,
      aplicavel: { ...SEM_RESTRICAO, ...aplicavel },
    })),
  }));
  return {
    id: idDe("modelo:padrao"),
    nome: "Checklist de mobilização (DEMO)",
    versao: 1,
    aplicavel: SEM_RESTRICAO,
    categorias,
  };
}

export const VEICULOS_DEMO = [
  { placa: "OWQ3A15", descricao: "Caminhonete", fabricante: "Ford", modelo: "Ranger", tipo: "leve", atributos: { tipo_freio: "Hidráulico", possui_giroflex: true } },
  { placa: "RTY4B22", descricao: "Caminhão pipa", fabricante: "Mercedes-Benz", modelo: "Atego", tipo: "caminhao", atributos: { tipo_freio: "Pneumático" } },
  { placa: null, codigo: "PQO1C83", descricao: "Escavadeira", fabricante: "Komatsu", modelo: "PC200", tipo: "maquina", atributos: {} },
  { placa: "JHK8D91", descricao: "Van", fabricante: "Mercedes-Benz", modelo: "Sprinter", tipo: "van", atributos: { tipo_freio: "Hidráulico", lotacao: 15 } },
  { placa: "BVL2E77", descricao: "Ônibus", fabricante: "Marcopolo", modelo: "G7", tipo: "onibus", atributos: { tipo_freio: "Pneumático", lotacao: 44 } },
];
