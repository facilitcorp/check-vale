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
 * Publica (v1) cada modelo cujo id ainda não existe. Idempotente; nunca altera
 * modelo já existente: depois da primeira carga, quem muda é a curadoria
 * (nova versão), e mudança de conteúdo aqui exige chave nova ou migração.
 * Modelo com setor que não existe mais pelo nome é pulado (e avisado).
 */
export async function carregarBiblioteca(db: Db, modelos: readonly ModeloConteudo[]): Promise<{ inseridos: number; pulados: string[] }> {
  return db.transacao(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(${TRAVA_SUBIDA})`);
    const { rows: setores } = await tx.query<{ id: string; nome: string }>(`SELECT id, nome FROM setores`);
    const porNome = new Map(setores.map((s) => [s.nome, s.id]));
    let inseridos = 0;
    const pulados: string[] = [];
    for (const m of modelos) {
      const id = idModeloBiblioteca(m.chave);
      const { rows } = await tx.query(`SELECT 1 FROM biblioteca_modelos WHERE id = $1 LIMIT 1`, [id]);
      if (rows.length > 0) continue;
      const setorIds = m.setores.map((n) => porNome.get(n));
      if (setorIds.some((s) => !s)) {
        pulados.push(m.nome);
        continue;
      }
      const categorias = montarCategorias(m);
      const erros = validarModeloBiblioteca({ categorias, origem: m.origem, fonte: m.fonte, setorIds: setorIds as string[] });
      if (erros.length > 0) throw new Error(`Modelo da biblioteca "${m.nome}" inválido: ${erros.join(" ")}`);
      await tx.query(
        `INSERT INTO biblioteca_modelos (id, versao, setor_ids, nome, resumo, origem, fonte, categorias, status, publicada_em)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, 'publicada', now())`,
        [id, setorIds, m.nome, m.resumo, m.origem, m.fonte, JSON.stringify(categorias)],
      );
      inseridos++;
    }
    return { inseridos, pulados };
  });
}
