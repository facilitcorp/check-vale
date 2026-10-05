import { situacaoSync } from './situacao';

const base = { online: true, pendentes: 0, sincronizando: false, comErro: false };

describe('situacaoSync: os seis estados', () => {
  it.each([
    [{ ...base, online: false, pendentes: 3 }, 'sem_conexao'],
    [{ ...base, online: false }, 'sem_conexao'],
    [base, 'enviado'],
    [{ ...base, pendentes: 2, sincronizando: true }, 'sincronizando'],
    [{ ...base, pendentes: 2, comErro: true }, 'erro'],
    [{ ...base, pendentes: 2, emAndamento: true }, 'salvo_local'],
    [{ ...base, pendentes: 2 }, 'aguardando'],
  ] as const)('%o → %s', (entrada, esperado) => {
    expect(situacaoSync(entrada)).toBe(esperado);
  });
});
