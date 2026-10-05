import { situacaoDe } from './estadoSync';

const p = (operacoes = 0, fotos = 0, recusas: string[] = []) => ({ operacoes, fotos, recusas });
const base = { online: true, sincronizando: false, falhou: false, pendencias: p() };

describe('situacaoDe: mesma regra da fundação', () => {
  it.each([
    [base, 'tudo_enviado'],
    [{ ...base, online: false }, 'tudo_enviado'], // sem pendência, falta de sinal não importa
    [{ ...base, online: false, pendencias: p(1) }, 'sem_conexao'],
    [{ ...base, pendencias: p(0, 2) }, 'aguardando_envio'], // foto pendente conta
    [{ ...base, sincronizando: true, pendencias: p(1) }, 'sincronizando'],
    [{ ...base, falhou: true, pendencias: p(1) }, 'erro'],
    [{ ...base, pendencias: p(0, 0, ['Placa já cadastrada']) }, 'erro'], // recusa é sempre erro
  ] as const)('%o → %s', (entrada, esperado) => {
    expect(situacaoDe({ ...entrada, pendencias: { ...entrada.pendencias, recusas: [...entrada.pendencias.recusas] } })).toBe(esperado);
  });
});
