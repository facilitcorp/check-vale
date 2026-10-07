import type { CategoriaConteudo, ModeloConteudo } from "./biblioteca";

/**
 * Modelos Base CheckVale. Itens genéricos de inspeção veicular: nada aqui é
 * apresentado como exigência de empresa, norma, cliente ou contrato. Item que
 * só existe em parte da frota permite "não se aplica"; a empresa ajusta ao adotar.
 */

const MINERACAO = "Mineração";

// Blocos genéricos reaproveitados entre modelos (cada modelo pode estender).
const documentacao: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Documento do veículo", "Disponível e dentro da validade.", "alta", false],
  ["Identificação da frota", "Prefixo ou código visível.", "baixa"],
  ["Hodômetro / horímetro", "Funcionando; leitura registrada.", "media", false],
]];

const externos: CategoriaConteudo = ["EXT", "Itens externos e cabine", "car", [
  ["Para-brisa", "Sem trincas no campo de visão do condutor.", "alta", false],
  ["Retrovisores", "Completos, ajustáveis e sem trincas.", "alta", false],
  ["Limpadores e esguicho", "Palhetas em bom estado e esguicho funcionando.", "media", false],
  ["Portas e travas", "Abrem, fecham e travam corretamente.", "alta", false],
  ["Carroceria", "Sem danos estruturais nem partes soltas.", "media", false],
]];

const iluminacao: CategoriaConteudo = ["LUZ", "Iluminação e sinalização", "light", [
  ["Faróis baixo e alto", "Acendem e estão alinhados.", "alta", false],
  ["Lanternas e luz de freio", "Funcionando nos dois lados.", "alta", false],
  ["Setas e pisca-alerta", "Funcionando nos dois lados.", "alta", false],
  ["Luz e alarme de ré", "Acionam ao engatar a ré.", "alta"],
  ["Buzina", "Funcionando.", "media", false],
]];

const motor: CategoriaConteudo = ["MOT", "Motor e fluidos", "engine", [
  ["Óleo do motor", "Nível entre mínimo e máximo.", "alta", false],
  ["Líquido de arrefecimento", "Nível dentro da faixa indicada.", "alta", false],
  ["Fluido de freio", "Nível adequado no reservatório.", "critica", false],
  ["Vazamentos aparentes", "Sem vazamento de óleo, combustível ou água.", "alta", false],
  ["Painel de instrumentos", "Sem luz de alerta acesa após a partida.", "alta", false],
]];

const freios: CategoriaConteudo = ["FRE", "Freios e direção", "brake", [
  ["Freio de serviço", "Pedal firme e frenagem uniforme.", "critica", false],
  ["Freio de estacionamento", "Segura o veículo parado em rampa.", "critica", false],
  ["Direção", "Sem folga excessiva, ruído ou puxando para um lado.", "critica", false],
]];

const pneus: CategoriaConteudo = ["PNE", "Pneus e rodas", "tire", [
  ["Pneus", "Sem cortes, bolhas ou desgaste além do limite.", "critica", false],
  ["Calibragem aparente", "Nenhum pneu visivelmente murcho.", "alta", false],
  ["Porcas e rodas", "Todas presentes e sem sinais de folga.", "critica", false],
  ["Estepe", "Presente e em condição de uso.", "media"],
]];

const segurancaVeiculoLeve: CategoriaConteudo = ["SEG", "Equipamentos de segurança", "shield", [
  ["Cintos de segurança", "Todos os assentos; travam e recolhem.", "critica", false],
  ["Triângulo, macaco e chave de roda", "Presentes e em condição de uso.", "media", false],
  ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
  ["Calço de roda", "Presente no veículo.", "media"],
]];

export const MODELOS_BIBLIOTECA: ModeloConteudo[] = [
  {
    chave: "mineracao:caminhonete-4x4",
    setores: [MINERACAO],
    nome: "Caminhonete / veículo leve 4x4",
    resumo: "Inspeção de pré-uso para caminhonete e veículo leve com tração 4x4 em operação de mineração.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao,
      externos,
      iluminacao,
      motor,
      freios,
      pneus,
      segurancaVeiculoLeve,
      ["OPE", "Uso em área operacional", "hard-hat", [
        ["Tração 4x4", "Engata e desengata sem ruído ou alerta no painel.", "alta"],
        ["Luz rotativa / giroflex", "Fixada e funcionando.", "alta"],
        ["Rádio de comunicação", "Liga, transmite e recebe.", "alta"],
        ["Caçamba e carga", "Limpa ou com carga amarrada; nada solto.", "alta"],
        ["Para-lama e protetores", "Fixados, sem partes soltas.", "baixa"],
      ]],
    ],
  },
];
