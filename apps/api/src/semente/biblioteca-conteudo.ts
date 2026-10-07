import type { CategoriaConteudo, ItemConteudo, ModeloConteudo } from "./biblioteca";
import {
  acoplamento, amarracao, betoneira, cabineMaquina, cacamba, documentacaoImplemento, documentacaoMaquina, estruturaImplemento, esteiras,
  faixasRefletivas, freioImplemento, freiosMaquina, guindautoObra, hidraulicoMaquina, iluminacaoImplemento, inicioMaquina, motorMaquina,
  rodasMaquina, segurancaMaquina, sinalizacaoMaquina, soloApoio, tacografo,
} from "./biblioteca-blocos";

/**
 * Modelos Base CheckVale: referência inicial de inspeção, personalizável pela
 * empresa. Itens genéricos de inspeção veicular e operacional; nada aqui é
 * apresentado como exigência de empresa, norma, cliente ou contrato, e a
 * criticidade é só sugestão (na dúvida, a mais conservadora). Item que só existe
 * em parte da frota permite "não se aplica".
 */

const MINERACAO = "Mineração";
const ENERGIA = "Energia elétrica";
const TRANSPORTE = "Transporte rodoviário e logística";
const CONSTRUCAO = "Construção civil e infraestrutura";

/** Bloco genérico acrescido de itens do modelo (mesmo código: os novos vêm no fim). */
const com = ([codigo, nome, icone, itens]: CategoriaConteudo, ...extras: ItemConteudo[]): CategoriaConteudo => [codigo, nome, icone, [...itens, ...extras]];

// --- Blocos genéricos -------------------------------------------------------

const documentacao: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Documento do veículo", "Disponível e dentro da validade.", "alta", false],
  ["Identificação da frota", "Prefixo ou código visível.", "baixa"],
  ["Hodômetro / horímetro", "Funcionando; leitura registrada.", "media", false],
]];

const cabine: CategoriaConteudo = ["CAB", "Cabine", "id-card", [
  ["Condições gerais da cabine", "Limpa, sem objetos soltos que possam rolar para os pedais.", "media", false],
  ["Banco do condutor", "Fixado e com regulagem funcionando.", "media", false],
  ["Cintos de segurança", "Todos os assentos; travam e recolhem.", "critica", false],
  ["Painel de instrumentos", "Sem luz de alerta acesa após a partida.", "alta", false],
  ["Ventilação e desembaçador", "Funcionando.", "baixa"],
]];

const externos: CategoriaConteudo = ["EXT", "Itens externos e carroceria", "car", [
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

const motor: CategoriaConteudo = ["MOT", "Motor, fluidos e bateria", "engine", [
  ["Óleo do motor", "Nível entre mínimo e máximo.", "alta", false],
  ["Líquido de arrefecimento", "Nível dentro da faixa indicada.", "alta", false],
  ["Fluido de freio", "Nível adequado no reservatório.", "critica", false],
  ["Vazamentos aparentes", "Sem vazamento de óleo, combustível ou água sob o veículo.", "alta", false],
  ["Bateria", "Fixada, terminais firmes e sem oxidação.", "media", false],
  ["Funcionamento do motor", "Parte sem dificuldade; sem ruído, fumaça ou vibração anormal.", "alta", false],
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

const seguranca: CategoriaConteudo = ["SEG", "Equipamentos de segurança", "shield", [
  ["Triângulo, macaco e chave de roda", "Presentes e em condição de uso.", "media", false],
  ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
  ["Calço de roda", "Presente no veículo.", "media"],
  ["Kit de primeiros socorros", "Presente e completo.", "baixa"],
]];

const carga: CategoriaConteudo = ["CAR", "Carga e acondicionamento", "car", [
  ["Carga amarrada ou acondicionada", "Nada solto na carroceria, caçamba ou baú.", "alta"],
  ["Peso e volume aparentes", "Sem excesso visível nem carga além das laterais.", "alta"],
  ["Ferramentas e materiais", "Guardados em local próprio; nada solto na cabine.", "media"],
]];

/** Pneumático só em parte da frota: "não se aplica" liberado. */
const freioAr: ItemConteudo[] = [
  ["Sistema de ar dos freios", "Pressão sobe ao normal; sem vazamento audível.", "critica"],
  ["Drenagem dos reservatórios de ar", "Feita; sem água ou óleo em excesso.", "media"],
];

const inicioOperacao = (...extras: ItemConteudo[]): CategoriaConteudo => ["INI", "Condições para início da operação", "hard-hat", [
  ["Volta ao redor do veículo", "Área livre de pessoas, objetos e obstáculos antes de mover.", "alta", false],
  ["Pendências anteriores", "Não conformidades da última inspeção tratadas ou liberadas.", "alta", false],
  ["Condutor", "Habilitado para este veículo e em condição de dirigir.", "critica", false],
  ...extras,
]];

const comunicacao: ItemConteudo[] = [
  ["Luz rotativa / giroflex", "Fixada e funcionando.", "alta"],
  ["Rádio de comunicação", "Liga, transmite e recebe.", "alta"],
];

const acessoCabine: ItemConteudo = ["Degraus e corrimãos de acesso", "Firmes, limpos e sem partes soltas.", "media", false];

// --- Itens de equipamento com içamento / elevação ---------------------------

const hidraulico: ItemConteudo[] = [
  ["Óleo hidráulico", "Nível dentro da faixa indicada.", "alta", false],
  ["Mangueiras e conexões hidráulicas", "Sem vazamento, ressecamento ou atrito.", "alta", false],
  ["Cilindros hidráulicos", "Sem vazamento e sem hastes riscadas ou amassadas.", "alta", false],
];

const estabilizadores: ItemConteudo[] = [
  ["Patolas / estabilizadores", "Estendem, apoiam e recolhem sem falha.", "critica", false],
  ["Sapatas e calços de apoio", "Presentes e sem danos.", "alta", false],
];

const comandos: ItemConteudo[] = [
  ["Comandos de operação", "Identificados e voltam sozinhos à posição neutra.", "critica", false],
  ["Parada de emergência", "Interrompe os movimentos ao ser acionada.", "critica"],
];

export const MODELOS_BIBLIOTECA: ModeloConteudo[] = [
  // --- Mineração -------------------------------------------------------------
  {
    chave: "mineracao:caminhonete-4x4",
    setores: [MINERACAO],
    nome: "Caminhonete / veículo leve 4x4",
    resumo: "Pré-uso de caminhonete e veículo leve com tração 4x4 em operação de mineração.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, cabine, externos, iluminacao, motor, freios, pneus, seguranca,
      ["OPE", "Itens do veículo", "hard-hat", [
        ["Tração 4x4", "Engata e desengata sem ruído ou alerta no painel.", "alta"],
        ...comunicacao,
        ["Haste de sinalização", "Fixada, com bandeira e luz funcionando.", "media"],
        ["Para-lamas e protetores", "Fixados, sem partes soltas.", "baixa"],
      ]],
      carga,
      inicioOperacao(),
    ],
  },
  {
    chave: "mineracao:caminhao",
    setores: [MINERACAO],
    nome: "Caminhão",
    resumo: "Pré-uso de caminhão de apoio, carga ou caçamba em operação de mineração.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      ["OPE", "Itens do veículo", "hard-hat", [
        ...comunicacao,
        ["Basculamento da caçamba", "Sobe e desce sem tranco nem vazamento.", "alta"],
        ["Trava da caçamba levantada", "Presente e funcionando.", "critica"],
        ["Para-lamas e protetores de roda", "Fixados, sem partes soltas.", "media"],
        ["Escapamento", "Fixado e sem vazamento de gases.", "media", false],
      ]],
      carga,
      inicioOperacao(),
    ],
  },
  {
    chave: "mineracao:onibus-van",
    setores: [MINERACAO],
    nome: "Ônibus / van",
    resumo: "Pré-uso de ônibus, micro-ônibus e van de transporte de pessoas.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, cabine, externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      ["PAS", "Área de passageiros", "id-card", [
        ["Bancos de passageiros", "Fixados, sem rasgos que exponham estrutura.", "media", false],
        ["Cintos dos passageiros", "Presentes, travam e recolhem.", "critica"],
        ["Portas de passageiros", "Abrem e fecham sem travar; vedação em bom estado.", "alta", false],
        ["Saídas de emergência", "Sinalizadas, desobstruídas e com dispositivo de abertura.", "critica"],
        ["Corredor, degraus e pega-mãos", "Livres, firmes e sem piso solto.", "alta", false],
        ["Iluminação interna", "Funcionando.", "media"],
        ["Limpeza interna", "Sem lixo, objetos soltos ou piso escorregadio.", "baixa", false],
      ]],
      ["OPE", "Itens do veículo", "hard-hat", comunicacao],
      inicioOperacao(),
    ],
  },
  {
    chave: "mineracao:equipamento-movel",
    setores: [MINERACAO],
    nome: "Equipamento móvel",
    resumo: "Pré-operação de equipamento móvel (carregadeira, escavadeira, trator, motoniveladora e similares).",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      ["DOC", "Documentação e identificação", "document", [
        ["Identificação do equipamento", "Prefixo ou código visível.", "baixa"],
        ["Horímetro", "Funcionando; leitura registrada.", "media", false],
        ["Manual ou tabela de operação", "Disponível no equipamento.", "baixa"],
      ]],
      ["CAB", "Cabine e acesso", "id-card", [
        acessoCabine,
        ["Estrutura de proteção da cabine", "Sem trincas, amassados ou fixação solta.", "critica", false],
        ["Vidros", "Sem trincas que atrapalhem a visão.", "alta", false],
        ["Cinto de segurança", "Trava e recolhe.", "critica", false],
        ["Painel e alarmes", "Sem alerta aceso após a partida.", "alta", false],
        ["Retrovisores / câmeras", "Completos, limpos e ajustados.", "alta"],
        ["Limpeza da cabine", "Sem objetos soltos junto aos comandos.", "media", false],
      ]],
      ["MOT", "Motor, fluidos e bateria", "engine", [
        ["Óleo do motor", "Nível entre mínimo e máximo.", "alta", false],
        ["Líquido de arrefecimento", "Nível dentro da faixa indicada.", "alta", false],
        ...hidraulico,
        ["Vazamentos aparentes", "Sem poça ou gotejamento sob o equipamento.", "alta", false],
        ["Bateria e chave geral", "Fixadas; chave geral funcionando.", "media", false],
        ["Acúmulo de material inflamável", "Sem graxa, óleo ou resíduos junto ao motor e escapamento.", "alta", false],
      ]],
      ["ROD", "Material rodante", "tire", [
        ["Pneus", "Sem cortes, bolhas ou desgaste além do limite.", "critica"],
        ["Porcas e rodas", "Todas presentes e sem sinais de folga.", "critica"],
        ["Esteiras", "Tensão aparente correta; sapatas e pinos completos.", "alta"],
        ["Roletes e rodas-guia", "Sem vazamento ou folga visível.", "media"],
      ]],
      ["IMP", "Implemento", "hard-hat", [
        ["Caçamba / lâmina / garfo", "Sem trincas ou deformações.", "alta"],
        ["Dentes e lâminas de corte", "Completos e fixados.", "media"],
        ["Pinos, buchas e travas", "Presentes, travados e lubrificados.", "alta", false],
      ]],
      ["LUZ", "Iluminação e sinalização", "light", [
        ["Faróis de trabalho", "Funcionando.", "alta"],
        ["Alarme de ré", "Aciona ao engatar a ré.", "alta", false],
        ["Buzina", "Funcionando.", "alta", false],
        ...comunicacao,
      ]],
      ["SEG", "Equipamentos de segurança", "shield", [
        ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
        ["Freio de serviço e de estacionamento", "Seguram o equipamento parado em rampa.", "critica", false],
      ]],
      ["INI", "Condições para início da operação", "hard-hat", [
        ["Volta ao redor do equipamento", "Área livre de pessoas e obstáculos antes de mover.", "alta", false],
        ["Teste dos comandos", "Movimentos respondem sem atraso ou tranco antes de iniciar o trabalho.", "critica", false],
        ["Pendências anteriores", "Não conformidades da última inspeção tratadas ou liberadas.", "alta", false],
        ["Operador", "Habilitado para este equipamento e em condição de operar.", "critica", false],
      ]],
    ],
  },
  {
    chave: "mineracao:pre-operacional",
    setores: [MINERACAO],
    nome: "Inspeção pré-operacional de veículo",
    resumo: "Inspeção geral antes de colocar qualquer veículo em operação. Bom ponto de partida para frota mista.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [documentacao, cabine, externos, iluminacao, motor, freios, pneus, seguranca, carga, inicioOperacao()],
  },

  // --- Energia elétrica ------------------------------------------------------
  {
    chave: "energia:caminhonete-operacional",
    setores: [ENERGIA],
    nome: "Caminhonete operacional",
    resumo: "Pré-uso de caminhonete de equipe de campo (leitura, inspeção de rede, atendimento).",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, cabine, externos, iluminacao, motor, freios, pneus, seguranca,
      ["OPE", "Itens do veículo", "hard-hat", [
        ...comunicacao,
        ["Escada no rack", "Presa ao suporte e sem degraus danificados.", "alta"],
        ["Cones e sinalização de área", "Presentes em quantidade para isolar o local.", "media"],
        ["Compartimentos de ferramentas", "Fecham e travam.", "media"],
      ]],
      carga,
      inicioOperacao(),
    ],
  },
  {
    chave: "energia:munck",
    setores: [ENERGIA],
    nome: "Caminhão Munck",
    resumo: "Pré-uso de caminhão com guindauto (Munck) em serviço de rede e subestação.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      ["GUI", "Guindauto", "hard-hat", [
        ...estabilizadores,
        ...hidraulico,
        ...comandos,
        ["Lança e extensões", "Sem trincas, amassados ou soldas abertas.", "critica", false],
        ["Gancho com trava", "Trava presente e fechando.", "critica", false],
        ["Cabo de aço / corrente", "Sem fios rompidos, nós ou amassados.", "critica"],
        ["Tabela de carga", "Fixada e legível junto aos comandos.", "alta", false],
        ["Acessórios de içamento", "Cintas, manilhas e estropos sem danos.", "alta"],
      ]],
      carga,
      inicioOperacao(),
    ],
  },
  {
    chave: "energia:cesto-aereo",
    setores: [ENERGIA],
    nome: "Caminhão com cesto aéreo",
    resumo: "Pré-uso de caminhão com cesto aéreo (plataforma para trabalho em altura).",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      ["CES", "Cesto e lança", "hard-hat", [
        ...estabilizadores,
        ...hidraulico,
        ...comandos,
        ["Comandos do cesto e da base", "Os dois funcionam; a base consegue recolher o cesto.", "critica", false],
        ["Descida de emergência", "Funciona sem o motor ligado.", "critica"],
        ["Cesto", "Sem trincas; piso e portinhola em bom estado.", "critica", false],
        ["Ponto de ancoragem no cesto", "Presente e sem deformação.", "critica", false],
        ["Partes isolantes da lança e do cesto", "Limpas, secas e sem danos aparentes.", "critica"],
        ["Nivelamento do cesto", "Cesto se mantém nivelado ao mover a lança.", "alta"],
        ["Indicador de nivelamento do veículo", "Legível e funcionando.", "media"],
      ]],
      carga,
      inicioOperacao(),
    ],
  },
  {
    chave: "energia:veiculo-manutencao",
    setores: [ENERGIA],
    nome: "Veículo de manutenção",
    resumo: "Pré-uso de utilitário, furgão ou caminhão-oficina de equipe de manutenção.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, cabine, externos, iluminacao, motor, freios, pneus, seguranca,
      ["OPE", "Itens do veículo", "hard-hat", [
        ...comunicacao,
        ["Compartimentos e baú", "Portas fecham e travam; nada solto dentro.", "alta", false],
        ["Prateleiras e fixações internas", "Firmes; ferramentas e peças presas.", "alta"],
        ["Escadas", "Presas ao suporte e sem degraus danificados.", "alta"],
        ["Gerador ou compressor embarcado", "Fixado, sem vazamento e funcionando.", "media"],
        ["Cones e sinalização de área", "Presentes em quantidade para isolar o local.", "media"],
      ]],
      carga,
      inicioOperacao(),
    ],
  },

  // --- Transporte rodoviário e logística -------------------------------------
  {
    chave: "transporte:caminhao",
    setores: [TRANSPORTE],
    nome: "Caminhão",
    resumo: "Pré-uso de caminhão de carga em operação rodoviária.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine, tacografo), externos, com(iluminacao, faixasRefletivas), motor, com(freios, ...freioAr), pneus, seguranca,
      com(carga, ...amarracao),
      inicioOperacao(),
    ],
  },
  {
    chave: "transporte:cavalo-mecanico",
    setores: [TRANSPORTE],
    nome: "Cavalo mecânico",
    resumo: "Pré-uso do cavalo mecânico, incluindo engate e acoplamento com a carreta.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine, tacografo), externos, com(iluminacao, faixasRefletivas), motor, com(freios, ...freioAr), pneus, seguranca,
      acoplamento,
      inicioOperacao(),
    ],
  },
  {
    chave: "transporte:carreta",
    setores: [TRANSPORTE],
    nome: "Carreta",
    resumo: "Inspeção do implemento rodoviário (semirreboque): engate, estrutura, freio, pneus, sinalização e carga.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoImplemento, acoplamento, estruturaImplemento, com(freioImplemento, ...freioAr), iluminacaoImplemento, pneus,
      com(carga, ...amarracao),
    ],
  },
  {
    chave: "transporte:van-utilitario",
    setores: [TRANSPORTE],
    nome: "Van / utilitário",
    resumo: "Pré-uso de van e utilitário de entrega ou apoio.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, cabine, externos, iluminacao, motor, freios, pneus, seguranca,
      com(carga,
        ["Separação entre cabine e carga", "Grade ou divisória íntegra, quando houver.", "media"],
        ["Portas traseira e lateral", "Abrem, fecham e travam corretamente.", "alta", false],
      ),
      inicioOperacao(),
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
      cabine, externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      com(carga, ...amarracao),
      inicioOperacao(["Descanso do condutor", "Condutor descansado e com pausas previstas no trajeto.", "alta", false]),
    ],
  },

  // --- Construção civil e infraestrutura -------------------------------------
  {
    chave: "construcao:caminhao",
    setores: [CONSTRUCAO],
    nome: "Caminhão",
    resumo: "Pré-uso de caminhão de obra (caçamba ou carroceria) em canteiro e via pública.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, com(iluminacao, faixasRefletivas), motor, com(freios, ...freioAr), pneus, seguranca,
      cacamba,
      carga,
      inicioOperacao(soloApoio),
    ],
  },
  {
    chave: "construcao:munck",
    setores: [CONSTRUCAO],
    nome: "Caminhão Munck",
    resumo: "Pré-uso de caminhão com guindauto (Munck) em canteiro de obra.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, iluminacao, motor, com(freios, ...freioAr), pneus, seguranca,
      ["GUI", "Guindauto", "hard-hat", [
        ...estabilizadores,
        ...hidraulico,
        ...comandos,
        ["Lança e extensões", "Sem trincas, amassados ou soldas abertas.", "critica", false],
        ["Gancho com trava", "Trava presente e fechando.", "critica", false],
        ["Cabo de aço / corrente", "Sem fios rompidos, nós ou amassados.", "critica"],
        ["Tabela de carga", "Fixada e legível junto aos comandos.", "alta", false],
        ["Acessórios de içamento", "Cintas, manilhas e estropos sem danos.", "alta"],
        ...guindautoObra,
      ]],
      carga,
      inicioOperacao(soloApoio),
    ],
  },
  {
    chave: "construcao:betoneira",
    setores: [CONSTRUCAO],
    nome: "Betoneira",
    resumo: "Pré-uso do caminhão betoneira: veículo, balão, sistema hidráulico e acesso à plataforma.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacao, com(cabine, acessoCabine), externos, com(iluminacao, faixasRefletivas), motor, com(freios, ...freioAr), pneus, seguranca,
      betoneira,
      inicioOperacao(soloApoio),
    ],
  },
  {
    chave: "construcao:escavadeira",
    setores: [CONSTRUCAO],
    nome: "Escavadeira",
    resumo: "Pré-operação de escavadeira sobre esteiras: motor, hidráulico, material rodante, cabine e área de trabalho.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina, com(cabineMaquina, acessoCabine, ...comandos), motorMaquina, com(hidraulicoMaquina, ...hidraulico), esteiras,
      ["IMP", "Lança, braço e caçamba", "hard-hat", [
        ["Lança e braço", "Sem trincas ou soldas soltas.", "alta", false],
        ["Caçamba e dentes", "Dentes presentes e fixados; caçamba sem trincas.", "media", false],
        ["Giro da superestrutura", "Gira sem ruído anormal; freio de giro segura a máquina.", "alta", false],
      ]],
      com(sinalizacaoMaquina, ...comunicacao), segurancaMaquina, inicioMaquina,
    ],
  },
  {
    chave: "construcao:retroescavadeira",
    setores: [CONSTRUCAO],
    nome: "Retroescavadeira",
    resumo: "Pré-operação de retroescavadeira: pá, retro, estabilizadores, pneus, freios e cabine.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina, com(cabineMaquina, acessoCabine, ...comandos), motorMaquina, com(hidraulicoMaquina, ...hidraulico), rodasMaquina, freiosMaquina,
      ["IMP", "Pá, retro e estabilizadores", "hard-hat", [
        ["Pá dianteira", "Lâmina e dentes fixados; sem trincas.", "media", false],
        ["Braço e caçamba da retro", "Sem trincas; dentes presentes e fixados.", "media", false],
        ...estabilizadores,
        ["Trava de transporte da retro", "Trava a lança para deslocamento.", "alta"],
      ]],
      com(sinalizacaoMaquina, ...comunicacao), segurancaMaquina, inicioMaquina,
    ],
  },
  {
    chave: "construcao:pa-carregadeira",
    setores: [CONSTRUCAO],
    nome: "Pá carregadeira",
    resumo: "Pré-operação de pá carregadeira: motor, hidráulico, pneus, freios, articulação e cabine.",
    origem: "base_checkvale",
    fonte: null,
    categorias: [
      documentacaoMaquina, com(cabineMaquina, acessoCabine, ...comandos), motorMaquina, com(hidraulicoMaquina, ...hidraulico), rodasMaquina, freiosMaquina,
      ["IMP", "Caçamba e articulação", "hard-hat", [
        ["Caçamba, lâmina e dentes", "Fixados; caçamba sem trincas.", "media", false],
        ["Braços de levantamento", "Sem trincas ou soldas soltas.", "alta", false],
        ["Articulação central", "Pinos lubrificados e sem folga; trava de articulação presente.", "alta", false],
      ]],
      com(sinalizacaoMaquina, ...comunicacao), segurancaMaquina, inicioMaquina,
    ],
  },
];
