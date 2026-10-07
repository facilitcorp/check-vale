import type { CategoriaConteudo } from "./biblioteca";

/**
 * Blocos de categoria para veículo pesado, implemento e máquina de obra
 * (Transporte e Construção). Mesmo princípio de biblioteca-conteudo.ts:
 * itens genéricos, criticidade sugerida conservadora e ajustável pela empresa,
 * sem atribuir nada a empresa, norma, cliente ou contrato.
 */

// ── Veículo pesado ─────────────────────────────────────────────────────────

// Bateria já está no bloco motor (biblioteca-conteudo.ts), que todo veículo usa.
export const eletrica: CategoriaConteudo = ["ELE", "Sistema elétrico", "engine", [
  ["Chave geral", "Liga e desliga o circuito corretamente.", "media"],
  ["Fiação aparente", "Sem fios expostos, emendas soltas ou sinais de aquecimento.", "alta", false],
]];

export const cabinePesado: CategoriaConteudo = ["CAB", "Cabine e condução", "car", [
  ["Cintos de segurança", "Todos os assentos; travam e recolhem.", "critica", false],
  ["Banco do condutor", "Fixado e com regulagem funcionando.", "media", false],
  ["Objetos soltos na cabine", "Nada solto que possa travar pedais ou cair sobre o condutor.", "alta", false],
  ["Degraus e corrimãos de acesso", "Firmes, limpos e sem partes quebradas.", "alta", false],
  ["Painel de instrumentos", "Sem luz de alerta acesa após a partida.", "alta", false],
  ["Ventilação e desembaçador", "Funcionando; vidros sem embaçar.", "baixa"],
  ["Registrador de velocidade e tempo (tacógrafo)", "Funcionando e com registro do dia.", "media"],
]];

export const freioAr: CategoriaConteudo = ["AR", "Sistema de ar", "brake", [
  ["Pressão de ar", "Atinge a pressão de trabalho indicada no painel em tempo normal.", "critica"],
  ["Vazamento de ar", "Sem vazamento audível com o motor desligado.", "critica"],
  ["Reservatórios de ar", "Drenados; sem excesso de água ou óleo.", "media"],
  ["Mangueiras e conexões de ar", "Sem ressecamento, cortes ou atrito.", "alta"],
]];

export const segurancaPesado: CategoriaConteudo = ["SEG", "Equipamentos de segurança", "shield", [
  ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
  ["Triângulo e sinalização de emergência", "Presentes e em condição de uso.", "media", false],
  ["Calços de roda", "Presentes no veículo.", "media"],
  ["Macaco e chave de roda", "Presentes e compatíveis com o veículo.", "media"],
  ["Faixas refletivas", "Completas, limpas e visíveis.", "media"],
]];

export const carga: CategoriaConteudo = ["CAR", "Carga e acondicionamento", "shield", [
  ["Amarração da carga", "Cintas, correntes ou catracas tensionadas; nada solto.", "critica"],
  ["Distribuição da carga", "Sem excesso aparente nem carga concentrada em um lado.", "alta"],
  ["Cintas e acessórios de amarração", "Sem cortes, desgaste ou ganchos deformados.", "alta"],
  ["Lona, portas e travas da carroceria", "Fechadas e travadas.", "media"],
]];

export const inicioRodoviario: CategoriaConteudo = ["INI", "Condições para início da operação", "hard-hat", [
  ["Condutor em condições de dirigir", "Condutor declara estar descansado e apto para a jornada.", "alta", false],
  ["Entorno do veículo", "Sem pessoas ou obstáculos antes de movimentar.", "alta", false],
  ["Pendências anteriores", "Não conformidades da última inspeção tratadas ou conhecidas.", "media", false],
]];

// ── Carreta / implemento rodoviário ───────────────────────────────────────

export const documentacaoImplemento: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Documento do implemento", "Disponível e dentro da validade.", "alta", false],
  ["Placa e identificação da frota", "Legíveis e fixadas.", "media", false],
]];

export const acoplamento: CategoriaConteudo = ["ACO", "Engate e acoplamento", "car", [
  ["Pino-rei", "Sem desgaste aparente e corretamente acoplado.", "critica"],
  ["Quinta roda", "Fixada, lubrificada e com a trava fechada.", "critica"],
  ["Mangueiras de ar entre cavalo e carreta", "Conectadas, sem vazamento e sem arrastar.", "critica"],
  ["Cabo elétrico entre cavalo e carreta", "Conectado e sem danos.", "alta"],
  ["Pés de apoio", "Recolhidos e travados para rodar.", "alta"],
]];

export const iluminacaoImplemento: CategoriaConteudo = ["LUZ", "Iluminação e sinalização", "light", [
  ["Lanternas e luz de freio", "Funcionando nos dois lados.", "alta", false],
  ["Setas", "Funcionando nos dois lados.", "alta", false],
  ["Luzes delimitadoras e de placa", "Acendem e estão íntegras.", "media", false],
  ["Faixas refletivas", "Completas, limpas e visíveis.", "media", false],
]];

export const estruturaImplemento: CategoriaConteudo = ["EST", "Estrutura do implemento", "car", [
  ["Chassi e longarinas", "Sem trincas, empenos ou soldas soltas.", "alta", false],
  ["Para-choque traseiro", "Fixado e sem deformação.", "alta", false],
  ["Para-lamas e para-barros", "Fixados.", "baixa"],
  ["Suspensão", "Molas, bolsas de ar e amortecedores sem quebra ou vazamento.", "alta", false],
  ["Freio da carreta", "Atua ao frear o conjunto; sem lona ou tambor com ruído anormal.", "critica", false],
]];

// ── Caminhões de obra ──────────────────────────────────────────────────────

export const cacamba: CategoriaConteudo = ["CAC", "Caçamba basculante", "car", [
  ["Basculamento", "Sobe e desce sem trancos nem vazamento hidráulico.", "alta"],
  ["Trava de segurança da caçamba", "Presente e funcionando para manutenção com caçamba erguida.", "critica"],
  ["Tampa traseira", "Abre e trava corretamente.", "media"],
  ["Alarme de caçamba levantada", "Avisa no painel quando a caçamba não está abaixada.", "media"],
]];

export const guindauto: CategoriaConteudo = ["MUN", "Guindauto (Munck)", "hard-hat", [
  ["Patolas", "Estendem, apoiam e travam; sapatas presentes.", "critica", false],
  ["Comandos", "Retornam ao neutro ao soltar; identificação legível.", "critica", false],
  ["Cilindros hidráulicos", "Sem vazamento nem haste danificada.", "alta", false],
  ["Mangueiras hidráulicas", "Sem vazamento, ressecamento ou atrito.", "alta", false],
  ["Gancho e trava do gancho", "Gancho sem deformação; trava funcionando.", "critica", false],
  ["Cabos, correntes e cintas de içamento", "Sem cortes, nós, desgaste ou elos deformados.", "critica"],
  ["Limitador ou indicador de carga", "Funcionando.", "alta"],
  ["Tabela de carga", "Fixada e legível junto aos comandos.", "media", false],
  ["Área de trabalho do guindauto", "Livre de redes elétricas aéreas e de pessoas no raio de giro.", "critica", false],
]];

export const betoneira: CategoriaConteudo = ["BET", "Balão e sistema de mistura", "engine", [
  ["Rotação do balão", "Gira nos dois sentidos sem ruído anormal.", "alta", false],
  ["Sistema hidráulico do balão", "Sem vazamento em bomba, motor e mangueiras.", "alta", false],
  ["Reservatório de água", "Abastecido, sem vazamento e com registro funcionando.", "media", false],
  ["Bica de descarga", "Fixada; prolongamentos travados.", "media", false],
  ["Escada e plataforma de acesso", "Firmes, sem partes soltas, com corrimão.", "alta", false],
  ["Limpeza do balão", "Sem concreto endurecido acumulado.", "baixa", false],
]];

export const inicioObra: CategoriaConteudo = ["INI", "Condições para início da operação", "hard-hat", [
  ["Condutor em condições de operar", "Condutor declara estar descansado e apto para a jornada.", "alta", false],
  ["Área de manobra", "Sem pessoas ou obstáculos; manobra de ré com apoio quando disponível.", "alta", false],
  ["Solo de apoio", "Firme e nivelado onde o veículo vai parar para operar.", "alta"],
]];

// ── Máquinas de obra ───────────────────────────────────────────────────────

export const documentacaoMaquina: CategoriaConteudo = ["DOC", "Documentação e identificação", "document", [
  ["Identificação do equipamento", "Prefixo ou código visível.", "baixa", false],
  ["Horímetro", "Funcionando; leitura registrada.", "media", false],
  ["Manual de operação", "Disponível na máquina ou com o operador.", "baixa"],
]];

export const motorMaquina: CategoriaConteudo = ["MOT", "Motor e fluidos", "engine", [
  ["Óleo do motor", "Nível entre mínimo e máximo.", "alta", false],
  ["Líquido de arrefecimento", "Nível dentro da faixa indicada.", "alta", false],
  ["Óleo hidráulico", "Nível dentro da faixa indicada.", "alta", false],
  ["Combustível", "Suficiente para a jornada; tampa fechada.", "media", false],
  ["Filtro de ar", "Sem indicação de saturação.", "media"],
  ["Vazamentos aparentes", "Sem vazamento de óleo, combustível ou água sob a máquina.", "alta", false],
  ["Bateria", "Fixada, terminais limpos e sem oxidação.", "alta", false],
  ["Painel de instrumentos", "Sem luz de alerta acesa após a partida.", "alta", false],
]];

export const hidraulico: CategoriaConteudo = ["HID", "Sistema hidráulico", "engine", [
  ["Mangueiras hidráulicas", "Sem vazamento, ressecamento ou atrito.", "alta", false],
  ["Cilindros hidráulicos", "Sem vazamento nem haste danificada.", "alta", false],
  ["Pinos e buchas", "Travados, lubrificados e sem folga excessiva.", "alta", false],
  ["Engate rápido do implemento", "Trava fechada e pino de segurança colocado.", "critica"],
]];

export const cabineMaquina: CategoriaConteudo = ["CAB", "Cabine e comandos", "car", [
  ["Cinto de segurança", "Trava e recolhe.", "critica", false],
  ["Vidros e estrutura de proteção da cabine", "Sem trincas que atrapalhem a visão; estrutura sem danos.", "alta", false],
  ["Retrovisores e câmera", "Completos, ajustados e limpos.", "alta"],
  ["Degraus e corrimãos de acesso", "Firmes, limpos e sem partes quebradas.", "alta", false],
  ["Comandos e joysticks", "Retornam ao neutro ao soltar.", "critica", false],
  ["Trava dos comandos", "Bloqueia os movimentos quando acionada.", "critica", false],
  ["Objetos soltos na cabine", "Nada solto que possa travar pedais ou comandos.", "media", false],
]];

export const sinalizacaoMaquina: CategoriaConteudo = ["LUZ", "Iluminação e sinalização", "light", [
  ["Faróis de trabalho", "Acendem e estão direcionados.", "media"],
  ["Buzina", "Funcionando.", "alta", false],
  ["Alarme de ré / deslocamento", "Aciona ao movimentar a máquina.", "alta"],
  ["Luz rotativa / giroflex", "Fixada e funcionando.", "media"],
]];

export const segurancaMaquina: CategoriaConteudo = ["SEG", "Equipamentos de segurança", "shield", [
  ["Extintor de incêndio", "Fixado, lacrado e dentro da validade.", "alta"],
  ["Proteções e tampas", "Capô e proteções de partes móveis fechados e fixados.", "alta", false],
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

export const inicioMaquina: CategoriaConteudo = ["INI", "Condições para início da operação", "hard-hat", [
  ["Operador em condições de operar", "Operador declara estar descansado e apto para a jornada.", "alta", false],
  ["Funcionamento após a partida", "Sem ruído, vibração ou fumaça anormais.", "alta", false],
  ["Área de trabalho e raio de giro", "Sem pessoas ou obstáculos ao alcance da máquina.", "critica", false],
  ["Redes aéreas e enterradas", "Verificadas e sinalizadas antes de escavar ou erguer o implemento.", "critica"],
  ["Solo de apoio", "Firme e nivelado para a máquina trabalhar.", "alta"],
  ["Estacionamento", "Implemento apoiado no solo e comandos travados ao sair da máquina.", "alta", false],
]];
