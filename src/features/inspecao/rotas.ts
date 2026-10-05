/** Caminhos do fluxo da inspeção (telas 5 a 12 do protótipo). */
export const rotas = {
  categorias: (v: string) => `/inspecao/${v}`,
  item: (v: string, itemId: string) => `/inspecao/${v}/item/${itemId}`,
  naoConformidade: (v: string, itemId: string) => `/inspecao/${v}/item/${itemId}/nao-conformidade`,
  resultado: (v: string) => `/inspecao/${v}/resultado`,
  resultadoCategorias: (v: string) => `/inspecao/${v}/resultado/categorias`,
  plano: (v: string) => `/inspecao/${v}/plano`,
};
