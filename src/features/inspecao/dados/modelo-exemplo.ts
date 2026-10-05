import type { ModeloChecklist } from '@/contracts/checklist';

/**
 * SOMENTE DESENVOLVIMENTO/TESTE. O modelo real vem da API (modelos
 * configuráveis por tipo de veículo e área). Categorias seguem o protótipo.
 */
const categorias: [id: string, nome: string, icone: string, itens: string[]][] = [
  ['identificacao', 'Identificação do veículo', 'id', [
    'Placa legível e íntegra', 'Chassi confere com documento', 'Adesivo de identificação da operação',
    'Número de frota visível', 'Hodômetro funcionando', 'Ano/modelo compatível com a exigência',
  ]],
  ['externos', 'Itens externos', 'externo', [
    'Estado geral da carroceria', 'Para-brisa sem trincas', 'Retrovisores íntegros', 'Limpadores funcionando',
    'Para-choques fixos', 'Portas abrem e travam', 'Faixas refletivas', 'Engate/reboque em ordem',
  ]],
  ['motor', 'Motor e fluidos', 'motor', [
    'Nível de óleo do motor', 'Nível do líquido de arrefecimento', 'Fluido de freio',
    'Sem vazamentos aparentes', 'Correias em bom estado', 'Bateria fixa e sem oxidação',
  ]],
  ['freios', 'Sistema de freios', 'freio', [
    'Freio de serviço eficiente', 'Freio de estacionamento', 'Pedal sem folga excessiva',
    'Luz de alerta do ABS apagada', 'Mangueiras sem desgaste',
  ]],
  ['pneus', 'Pneus e rodas', 'pneu', [
    'Sulco dentro do limite', 'Calibragem adequada', 'Estepe em condição de uso',
    'Porcas completas e apertadas', 'Sem bolhas ou cortes',
  ]],
  ['iluminacao', 'Iluminação e sinalização', 'luz', [
    'Faróis baixo e alto', 'Lanternas traseiras', 'Luz de freio', 'Setas e pisca-alerta',
    'Luz de ré e alarme sonoro', 'Giroflex', 'Iluminação lateral',
  ]],
  ['cabine', 'Cabine e segurança', 'cabine', [
    'Cintos de segurança', 'Extintor dentro da validade', 'Kit de primeiros socorros',
    'Triângulo e macaco', 'Bancos fixos', 'Buzina funcionando',
  ]],
  ['telemetria', 'Telemetria e tecnologia', 'telemetria', [
    'Rastreador instalado e ativo', 'Câmera de fadiga instalada', 'Sensor de estacionamento',
    'Limitador de velocidade', 'Rádio de comunicação', 'Tacógrafo/computador de bordo',
  ]],
  ['vale', 'Itens Vale (área operacional)', 'operacao', [
    'Bandeira de sinalização', 'Calço de roda', 'Cones de sinalização', 'Antena com bandeirola',
    'Kit de contenção ambiental', 'Faixa refletiva de área', 'Corrente de bloqueio', 'Lanterna portátil',
  ]],
  ['documentacao', 'Documentação', 'documento', [
    'CRLV em dia', 'Seguro obrigatório', 'Laudo de inspeção',
  ]],
];

export const MODELO_EXEMPLO: ModeloChecklist = {
  id: 'exemplo-leve',
  versao: 1,
  nome: 'Veículo leve (exemplo)',
  categorias: categorias.map(([id, nome, icone, itens], ci) => ({
    id,
    nome,
    icone,
    ordem: ci + 1,
    itens: itens.map((titulo, ii) => ({
      id: `${id}-${ii + 1}`,
      categoriaId: id,
      ordem: ii + 1,
      titulo,
      permiteNaoSeAplica: true,
    })),
  })),
};
