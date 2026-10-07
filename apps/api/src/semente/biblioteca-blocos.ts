import type { CategoriaConteudo, ItemConteudo } from "./biblioteca";

/**
 * Blocos de Transporte e Construção: só o que os blocos genéricos de
 * biblioteca-conteudo.ts não cobrem (implemento rodoviário, caçamba, betoneira,
 * máquina de obra). Os modelos combinam estes com os genéricos via `com()`.
 * Mesmas regras: itens genéricos, criticidade só sugestão, sem empresa/norma/contrato.
 */

// --- Veículo pesado ---------------------------------------------------------

export const tacografo: ItemConteudo = ["Registrador de velocidade e tempo (tacógrafo)", "Funcionando e com registro do dia.", "media"];

export const faixasRefletivas: ItemConteudo = ["Faixas refletivas", "Completas, limpas e visíveis.", "media"];

export const amarracao: ItemConteudo[] = [
  ["Cintas, correntes e catracas", "Tensionadas; sem cortes, desgaste ou ganchos deformados.", "critica"],
  ["Lona, portas e travas da carroceria", "Fechadas e travadas.", "media"],
];

export const soloApoio: ItemConteudo = ["Solo de apoio", "Firme e nivelado onde o veículo vai parar para operar.", "alta"];

// --- Carreta / implemento rodoviário ---------------------------------------

export const documentacaoImplemento: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Documento do implemento", "Disponível e dentro da validade.", "alta", false],
  ["Placa e identificação da frota", "Legíveis e fixadas.", "media", false],
]];

export const acoplamento: CategoriaConteudo = ["ACO", "Engate e acoplamento", "car", [
  ["Pino-rei", "Sem desgaste aparente e corretamente acoplado.", "critica"],
  ["Quinta roda", "Fixada, lubrificada e com a trava fechada.", "critica"],
  ["Mangueiras de ar entre cavalo e carreta", "Conectadas, sem vazamento e sem arrastar.", "critica"],
  ["Cabo elétrico entre cavalo e carreta", "Conectado e sem danos.", "alta"],
  ["Pés de apoio da carreta", "Recolhidos e travados para rodar.", "alta"],
]];

export const estruturaImplemento: CategoriaConteudo = ["EST", "Estrutura do implemento", "car", [
  ["Chassi e longarinas", "Sem trincas, empenos ou soldas soltas.", "alta", false],
  ["Para-choque traseiro", "Fixado e sem deformação.", "alta", false],
  ["Para-lamas e para-barros", "Fixados.", "baixa"],
  ["Suspensão", "Molas, bolsas de ar e amortecedores sem quebra ou vazamento.", "alta", false],
]];

export const freioImplemento: CategoriaConteudo = ["FRE", "Freios", "brake", [
  ["Freio da carreta", "Atua ao frear o conjunto; sem ruído anormal em lonas ou tambores.", "critica", false],
]];

export const iluminacaoImplemento: CategoriaConteudo = ["LUZ", "Iluminação e sinalização", "light", [
  ["Lanternas e luz de freio", "Funcionando nos dois lados.", "alta", false],
  ["Setas", "Funcionando nos dois lados.", "alta", false],
  ["Luzes delimitadoras e de placa", "Acendem e estão íntegras.", "media", false],
  faixasRefletivas,
]];

// --- Caminhões de obra ------------------------------------------------------

export const cacamba: CategoriaConteudo = ["CAC", "Caçamba basculante", "car", [
  ["Basculamento", "Sobe e desce sem tranco nem vazamento hidráulico.", "alta"],
  ["Trava da caçamba levantada", "Presente e funcionando.", "critica"],
  ["Tampa traseira", "Abre e trava corretamente.", "media"],
  ["Alarme de caçamba levantada", "Avisa no painel quando a caçamba não está abaixada.", "media"],
]];

export const betoneira: CategoriaConteudo = ["BET", "Balão e sistema de mistura", "engine", [
  ["Rotação do balão", "Gira nos dois sentidos sem ruído anormal.", "alta", false],
  ["Sistema hidráulico do balão", "Sem vazamento em bomba, motor e mangueiras.", "alta", false],
  ["Reservatório de água", "Abastecido, sem vazamento e com registro funcionando.", "media", false],
  ["Bica de descarga", "Fixada; prolongamentos travados.", "media", false],
  ["Escada e plataforma do balão", "Firmes, sem partes soltas, com corrimão.", "alta", false],
  ["Limpeza do balão", "Sem concreto endurecido acumulado.", "baixa", false],
]];

/** Guindauto em obra: o que muda em relação ao de rede elétrica. */
export const guindautoObra: ItemConteudo[] = [
  ["Limitador ou indicador de carga", "Funcionando.", "alta"],
  ["Área de giro", "Livre de redes elétricas aéreas e de pessoas no raio da lança.", "critica", false],
];

// --- Máquinas de obra -------------------------------------------------------

export const documentacaoMaquina: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Identificação do equipamento", "Prefixo ou código visível.", "baixa"],
  ["Horímetro", "Funcionando; leitura registrada.", "media", false],
  ["Manual de operação", "Disponível na máquina ou com o operador.", "baixa"],
]];

export const cabineMaquina: CategoriaConteudo = ["CAB", "Cabine e comandos", "id-card", [
  ["Estrutura de proteção da cabine", "Sem trincas, amassados ou fixação solta.", "critica", false],
  ["Vidros", "Sem trincas que atrapalhem a visão.", "alta", false],
  ["Cinto de segurança", "Trava e recolhe.", "critica", false],
  ["Retrovisores / câmeras", "Completos, limpos e ajustados.", "alta"],
  ["Trava dos comandos", "Bloqueia os movimentos quando acionada.", "critica", false],
  ["Limpeza da cabine", "Sem objetos soltos junto aos pedais e comandos.", "media", false],
]];

export const motorMaquina: CategoriaConteudo = ["MOT", "Motor, fluidos e bateria", "engine", [
  ["Óleo do motor", "Nível entre mínimo e máximo.", "alta", false],
  ["Líquido de arrefecimento", "Nível dentro da faixa indicada.", "alta", false],
  ["Combustível", "Suficiente para a jornada; tampa fechada.", "media", false],
  ["Filtro de ar", "Sem indicação de saturação.", "media"],
  ["Vazamentos aparentes", "Sem poça ou gotejamento sob a máquina.", "alta", false],
  ["Bateria e chave geral", "Fixadas; chave geral funcionando.", "media", false],
  ["Painel e alarmes", "Sem alerta aceso após a partida.", "alta", false],
  ["Acúmulo de material inflamável", "Sem graxa, óleo ou resíduos junto ao motor e escapamento.", "alta", false],
]];

/** Complementa os itens hidráulicos genéricos (óleo, mangueiras, cilindros). */
export const hidraulicoMaquina: CategoriaConteudo = ["HID", "Sistema hidráulico", "engine", [
  ["Pinos e buchas", "Presentes, travados, lubrificados e sem folga excessiva.", "alta", false],
  ["Engate rápido do implemento", "Trava fechada e pino de segurança colocado.", "critica"],
]];

export const esteiras: CategoriaConteudo = ["ROD", "Material rodante (esteiras)", "tire", [
  ["Tensão das esteiras", "Sem esteira frouxa ou excessivamente esticada.", "alta", false],
  ["Sapatas e parafusos", "Sem sapata solta, quebrada ou faltando parafuso.", "alta", false],
  ["Roletes, rodas-guia e roda motriz", "Sem vazamento, travamento ou desgaste excessivo.", "media", false],
]];

export const rodasMaquina: CategoriaConteudo = ["ROD", "Pneus e rodas", "tire", [
  ["Pneus", "Sem cortes, bolhas ou desgaste além do limite.", "critica", false],
  ["Calibragem aparente", "Nenhum pneu visivelmente murcho.", "alta", false],
  ["Porcas e rodas", "Todas presentes e sem sinais de folga.", "critica", false],
]];

export const freiosMaquina: CategoriaConteudo = ["FRE", "Freios e direção", "brake", [
  ["Freio de serviço", "Para a máquina de forma uniforme.", "critica", false],
  ["Freio de estacionamento", "Segura a máquina parada em rampa.", "critica", false],
  ["Direção", "Responde sem folga excessiva nem ruído.", "critica", false],
]];

export const sinalizacaoMaquina: CategoriaConteudo = ["LUZ", "Iluminação e sinalização", "light", [
  ["Faróis de trabalho", "Funcionando.", "alta"],
  ["Alarme de ré / deslocamento", "Aciona ao movimentar a máquina.", "alta", false],
  ["Buzina", "Funcionando.", "alta", false],
]];

export const segurancaMaquina: CategoriaConteudo = ["SEG", "Equipamentos de segurança", "shield", [
  ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
  ["Proteções e tampas", "Capô e proteções de partes móveis fechados e fixados.", "alta", false],
]];

export const inicioMaquina: CategoriaConteudo = ["INI", "Condições para início da operação", "hard-hat", [
  ["Volta ao redor do equipamento", "Área livre de pessoas e obstáculos no raio de giro antes de mover.", "critica", false],
  ["Redes aéreas e enterradas", "Verificadas e sinalizadas antes de escavar ou erguer o implemento.", "critica"],
  soloApoio,
  ["Teste dos comandos", "Movimentos respondem sem atraso ou tranco antes de iniciar o trabalho.", "critica", false],
  ["Pendências anteriores", "Não conformidades da última inspeção tratadas ou liberadas.", "alta", false],
  ["Operador", "Habilitado para este equipamento e em condição de operar.", "critica", false],
  ["Estacionamento", "Implemento apoiado no solo e comandos travados ao sair da máquina.", "alta", false],
]];
