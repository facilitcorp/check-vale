import { EVIDENCIA_PADRAO, SEM_RESTRICAO, validarModeloBiblioteca, type CategoriaChecklist, type Criticidade, type EvidenciaItem, type OrigemBiblioteca } from "@checkvale/shared";
import { TRAVA_SUBIDA, type Db } from "../db";
import { idDe } from "./dados";

/**
 * Conteúdo da biblioteca que vem com o produto (não é DEMO: entra em todo ambiente).
 * Origem honesta (docs/BIBLIOTECA.md): base_checkvale não cita empresa, norma,
 * cliente ou contrato como exigência; referencia só com fonte.
 */

/** [título, descrição, criticidade sugerida, permite "não se aplica" (padrão: sim), evidência (padrão: foto só na NC)] */
export type ItemConteudo = [titulo: string, descricao: string, criticidade: Criticidade, permiteNaoAplica?: boolean, evidencia?: EvidenciaItem];

/** O item pede foto mesmo conforme. Usar pouco: cada foto é um passo a mais no campo. */
export const comFoto = ([t, d, c, na]: ItemConteudo): ItemConteudo => [t, d, c, na, "foto"];
/** O item pede um registro em texto (ex.: leitura). */
export const comObservacao = ([t, d, c, na]: ItemConteudo): ItemConteudo => [t, d, c, na, "observacao"];
/** Verifica-se acionando ou olhando na hora: nada a registrar se conforme (a NC continua exigindo foto). */
export const semEvidencia = ([t, d, c, na]: ItemConteudo): ItemConteudo => [t, d, c, na, "sem_evidencia"];
/** [código, nome, ícone, itens]. Código da categoria vira prefixo do código do item. */
export type CategoriaConteudo = [codigo: string, nome: string, icone: string, itens: ItemConteudo[]];

export interface ModeloConteudo {
  /** Chave estável: dela sai o id. Nunca reaproveitar para outro modelo. */
  chave: string;
  /** Pelo NOME do setor da semente 003 (setor é cadastro e só tem id aleatório). */
  setores: string[];
  nome: string;
  resumo: string;
  origem: OrigemBiblioteca;
  fonte: string | null;
  categorias: CategoriaConteudo[];
}

export function montarCategorias(m: Pick<ModeloConteudo, "chave" | "categorias">): CategoriaChecklist[] {
  return m.categorias.map(([codigo, nome, icone, itens], ci) => ({
    id: idDe(`biblioteca:${m.chave}:${codigo}`),
    codigo,
    nome,
    icone,
    ordem: ci + 1,
    aplicavel: SEM_RESTRICAO,
    itens: itens.map(([titulo, descricao, criticidade, permiteNaoAplica, evidencia], ii) => ({
      id: idDe(`biblioteca:${m.chave}:${codigo}:${ii + 1}`),
      codigo: `${codigo}.${ii + 1}`,
      titulo,
      descricao,
      ordem: ii + 1,
      permiteNaoAplica: permiteNaoAplica ?? true,
      criticidadeSugerida: criticidade,
      aplicavel: SEM_RESTRICAO,
      // Explícito na cópia: a empresa vê no editor o que o modelo sugere.
      evidencia: evidencia ?? EVIDENCIA_PADRAO,
    })),
  }));
}

export const idModeloBiblioteca = (chave: string) => idDe(`biblioteca:modelo:${chave}`);

/**
 * Publica (v1) cada modelo cujo id ainda não existe. Idempotente. Modelo que a
 * curadoria nunca tocou (versão em vigor publicada pela carga, sem
 * `publicada_por`) acompanha o conteúdo do produto: se mudou, a carga publica a
 * versão seguinte (setores da versão em vigor). Depois que a curadoria abre
 * rascunho ou publica, o modelo é dela e a carga não mexe mais. Cópias já
 * adotadas pelas empresas não mudam: guardam a versão de origem.
 * Modelo novo com setor que não existe mais pelo nome é pulado (e avisado).
 */
export async function carregarBiblioteca(
  db: Db,
  modelos: readonly ModeloConteudo[],
): Promise<{ inseridos: number; atualizados: number; pulados: string[] }> {
  return db.transacao(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(${TRAVA_SUBIDA})`);
    const { rows: setores } = await tx.query<{ id: string; nome: string }>(`SELECT id, nome FROM setores`);
    const porNome = new Map(setores.map((s) => [s.nome, s.id]));
    let inseridos = 0;
    let atualizados = 0;
    const pulados: string[] = [];
    for (const m of modelos) {
      const id = idModeloBiblioteca(m.chave);
      const categorias = montarCategorias(m);
      const { rows } = await tx.query<{ versao: number; status: string; publicada_por: string | null; setor_ids: string[]; igual: boolean }>(
        `SELECT versao, status, publicada_por, setor_ids,
                (nome = $2 AND resumo = $3 AND origem = $4 AND fonte IS NOT DISTINCT FROM $5 AND categorias = $6::jsonb) AS igual
           FROM biblioteca_modelos WHERE id = $1 ORDER BY versao DESC LIMIT 1`,
        [id, m.nome, m.resumo, m.origem, m.fonte, JSON.stringify(categorias)],
      );
      const ultima = rows[0];
      if (ultima) {
        if (ultima.status !== "publicada" || ultima.publicada_por !== null || ultima.igual) continue;
        validar(m, categorias, ultima.setor_ids);
        await tx.query(`UPDATE biblioteca_modelos SET status = 'arquivada' WHERE id = $1 AND status = 'publicada'`, [id]);
        await inserir(tx, id, ultima.versao + 1, ultima.setor_ids, m, categorias);
        atualizados++;
        continue;
      }
      const setorIds = m.setores.map((n) => porNome.get(n));
      if (setorIds.some((s) => !s)) {
        pulados.push(m.nome);
        continue;
      }
      validar(m, categorias, setorIds as string[]);
      await inserir(tx, id, 1, setorIds as string[], m, categorias);
      inseridos++;
    }
    return { inseridos, atualizados, pulados };
  });
}

function validar(m: ModeloConteudo, categorias: CategoriaChecklist[], setorIds: string[]) {
  const erros = validarModeloBiblioteca({ categorias, origem: m.origem, fonte: m.fonte, setorIds });
  if (erros.length > 0) throw new Error(`Modelo da biblioteca "${m.nome}" inválido: ${erros.join(" ")}`);
}

async function inserir(tx: Pick<Db, "query">, id: string, versao: number, setorIds: string[], m: ModeloConteudo, categorias: CategoriaChecklist[]) {
  await tx.query(
    `INSERT INTO biblioteca_modelos (id, versao, setor_ids, nome, resumo, origem, fonte, categorias, status, publicada_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'publicada', now())`,
    [id, versao, setorIds, m.nome, m.resumo, m.origem, m.fonte, JSON.stringify(categorias)],
  );
}
