import type { CategoriaConteudo, ModeloConteudo } from "./biblioteca";
import {
  acoplamento, betoneira, cabineMaquina, cabinePesado, cacamba, carga, documentacaoImplemento, documentacaoMaquina, eletrica,
  esteiras, estruturaImplemento, freioAr, freiosMaquina, guindauto, hidraulico, iluminacaoImplemento, inicioMaquina, inicioObra,
  inicioRodoviario, motorMaquina, rodasMaquina, segurancaMaquina, segurancaPesado, sinalizacaoMaquina,
} from "./biblioteca-blocos";

/**
 * Modelos Base CheckVale. Itens genéricos de inspeção veicular: nada aqui é
 * apresentado como exigência de empresa, norma, cliente ou contrato. Item que
 * só existe em parte da frota permite "não se aplica"; a empresa ajusta ao adotar.
 */

const MINERACAO = "Mineração";
const TRANSPORTE = "Transporte rodoviário e logística";
const CONSTRUCAO = "Construção civil e infraestrutura";

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

  // ── Transporte rodoviário e logística ──
  {
    chave: "transporte:caminhao",
    setores: [TRANSPORTE],
    nome: "Caminhão",
    resumo: "Inspeção de pré-uso para caminhão de carga em operação rodoviária.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, externos, iluminacao, motor, eletrica, freios, freioAr, pneus, cabinePesado, segurancaPesado, carga, inicioRodoviario],
  },
  {
    chave: "transporte:cavalo-mecanico",
    setores: [TRANSPORTE],
    nome: "Cavalo mecânico",
    resumo: "Inspeção de pré-uso do cavalo mecânico, incluindo engate e acoplamento com a carreta.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, externos, iluminacao, motor, eletrica, freios, freioAr, pneus, acoplamento, cabinePesado, segurancaPesado, inicioRodoviario],
  },
  {
    chave: "transporte:carreta",
    setores: [TRANSPORTE],
    nome: "Carreta",
    resumo: "Inspeção do implemento rodoviário (semirreboque): estrutura, freio, pneus, sinalização e carga.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacaoImplemento, acoplamento, estruturaImplemento, iluminacaoImplemento, pneus, carga],
  },
  {
    chave: "transporte:van-utilitario",
    setores: [TRANSPORTE],
    nome: "Van / utilitário",
    resumo: "Inspeção de pré-uso para van e utilitário de entrega ou apoio.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao,
      externos,
      iluminacao,
      motor,
      eletrica,
      freios,
      pneus,
      segurancaVeiculoLeve,
      ["CAR", "Carga e acondicionamento", "shield", [
        ["Carga acondicionada", "Presa ou travada; nada solto no compartimento.", "alta"],
        ["Separação entre cabine e carga", "Grade ou divisória íntegra, quando houver.", "media"],
        ["Portas traseira e lateral", "Abrem, fecham e travam corretamente.", "alta", false],
      ]],
      inicioRodoviario,
    ],
  },
  {
    chave: "transporte:pre-viagem",
    setores: [TRANSPORTE],
    nome: "Checklist pré-viagem",
    resumo: "Verificação antes de sair para a viagem: veículo, carga, documentos e preparo do trajeto.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao,
      ["VIA", "Preparação da viagem", "document", [
        ["Documentos da carga", "Notas e documentos de transporte a bordo.", "alta"],
        ["Rota e paradas", "Trajeto, pontos de parada e descanso definidos.", "media"],
        ["Combustível", "Suficiente para o trecho até o próximo abastecimento.", "media", false],
        ["Contatos de emergência", "Telefone da base e de socorro disponíveis ao condutor.", "media", false],
        ["Comunicação", "Celular ou rádio carregado e funcionando.", "media", false],
      ]],
      externos,
      iluminacao,
      motor,
      freios,
      pneus,
      cabinePesado,
      segurancaPesado,
      carga,
      inicioRodoviario,
    ],
  },

  // ── Construção civil e infraestrutura ──
  {
    chave: "construcao:caminhao",
    setores: [CONSTRUCAO],
    nome: "Caminhão",
    resumo: "Inspeção de pré-uso para caminhão de obra (caçamba ou carroceria) em canteiro e via pública.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, externos, iluminacao, motor, eletrica, freios, freioAr, pneus, cabinePesado, segurancaPesado, cacamba, carga, inicioObra],
  },
  {
    chave: "construcao:munck",
    setores: [CONSTRUCAO],
    nome: "Caminhão Munck",
    resumo: "Inspeção do caminhão com guindauto: veículo, patolas, comandos, hidráulico e acessórios de içamento.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, externos, iluminacao, motor, eletrica, freios, freioAr, pneus, cabinePesado, segurancaPesado, guindauto, inicioObra],
  },
  {
    chave: "construcao:betoneira",
    setores: [CONSTRUCAO],
    nome: "Betoneira",
    resumo: "Inspeção do caminhão betoneira: veículo, balão, sistema hidráulico e acesso à plataforma.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, externos, iluminacao, motor, eletrica, freios, freioAr, pneus, cabinePesado, segurancaPesado, betoneira, inicioObra],
  },
  {
    chave: "construcao:escavadeira",
    setores: [CONSTRUCAO],
    nome: "Escavadeira",
    resumo: "Inspeção de pré-operação da escavadeira sobre esteiras: motor, hidráulico, material rodante, cabine e área de trabalho.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina,
      motorMaquina,
      hidraulico,
      esteiras,
      ["IMP", "Lança, braço e caçamba", "hard-hat", [
        ["Lança e braço", "Sem trincas ou soldas soltas.", "alta", false],
        ["Caçamba e dentes", "Dentes presentes e fixados; caçamba sem trincas.", "media", false],
        ["Giro da superestrutura", "Gira sem ruído anormal; freio de giro segura a máquina.", "alta", false],
      ]],
      cabineMaquina,
      sinalizacaoMaquina,
      segurancaMaquina,
      inicioMaquina,
    ],
  },
  {
    chave: "construcao:retroescavadeira",
    setores: [CONSTRUCAO],
    nome: "Retroescavadeira",
    resumo: "Inspeção de pré-operação da retroescavadeira: pá carregadeira, retro, estabilizadores, pneus, freios e cabine.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina,
      motorMaquina,
      hidraulico,
      rodasMaquina,
      freiosMaquina,
      ["IMP", "Pá, retro e estabilizadores", "hard-hat", [
        ["Pá dianteira", "Lâmina e dentes fixados; sem trincas.", "media", false],
        ["Braço e caçamba da retro", "Sem trincas; dentes presentes e fixados.", "media", false],
        ["Estabilizadores", "Descem, apoiam e sobem sem vazamento.", "alta", false],
        ["Trava de transporte da retro", "Trava a lança para deslocamento.", "alta"],
      ]],
      cabineMaquina,
      sinalizacaoMaquina,
      segurancaMaquina,
      inicioMaquina,
    ],
  },
  {
    chave: "construcao:pa-carregadeira",
    setores: [CONSTRUCAO],
    nome: "Pá carregadeira",
    resumo: "Inspeção de pré-operação da pá carregadeira: motor, hidráulico, pneus, freios, articulação e cabine.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina,
      motorMaquina,
      hidraulico,
      rodasMaquina,
      freiosMaquina,
      ["IMP", "Caçamba e articulação", "hard-hat", [
        ["Caçamba, lâmina e dentes", "Fixados; caçamba sem trincas.", "media", false],
        ["Braços de levantamento", "Sem trincas ou soldas soltas.", "alta", false],
        ["Articulação central", "Pinos lubrificados e sem folga; trava de articulação presente.", "alta", false],
      ]],
      cabineMaquina,
      sinalizacaoMaquina,
      segurancaMaquina,
      inicioMaquina,
    ],
  },
];
