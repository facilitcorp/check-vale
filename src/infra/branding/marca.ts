/**
 * Identidade visual e textos de marca. NADA de marca fica fixo nas telas:
 * tudo sai daqui, e a fundação pode trocar esta fonte (API/ambiente) sem
 * mexer em componente. Valores abaixo são o padrão do protótipo.
 */
export interface Marca {
  nome: string;
  cores: {
    primaria: string;
    primariaEscura: string;
    destaque: string;
  };
  /** Link do botão "Falar com especialista". Sem link, o botão não aparece. */
  contatoEspecialista?: string;
}

export const MARCA_PADRAO: Marca = {
  nome: 'CheckVale',
  cores: {
    primaria: '#0b6b45',
    primariaEscura: '#06492f',
    destaque: '#f5b301',
  },
};

export function aplicarMarca(marca: Marca, raiz: HTMLElement = document.documentElement) {
  raiz.style.setProperty('--cor-primaria', marca.cores.primaria);
  raiz.style.setProperty('--cor-primaria-escura', marca.cores.primariaEscura);
  raiz.style.setProperty('--cor-destaque', marca.cores.destaque);
  document.title = marca.nome;
}
