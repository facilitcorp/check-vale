import { MIGRACOES } from "./migracoes";

/** Interface mínima de banco: atendida por PGlite (dev/teste) e pg.Pool (produção). */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transacao<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
  fechar(): Promise<void>;
}

export async function abrirDb(opts: { databaseUrl: string | null; dataDir: string | null }): Promise<Db> {
  if (opts.databaseUrl) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 10 });
    // Conexão ociosa que cai (reinício do Cloud SQL, rede) emite "error" no pool: sem ouvinte, derruba o processo.
    pool.on("error", (e) => console.error(JSON.stringify({ severity: "WARNING", message: `Postgres: conexão ociosa caiu (${e.message})` })));
    return {
      query: async (sql, params) => pool.query(sql, params as unknown[]) as never,
      transacao: async (fn) => {
        const cli = await pool.connect();
        try {
          await cli.query("BEGIN");
          const tx: Db = {
            query: async (sql, params) => cli.query(sql, params as unknown[]) as never,
            transacao: (f) => f(tx),
            fechar: async () => {},
          };
          const r = await fn(tx);
          await cli.query("COMMIT");
          return r;
        } catch (e) {
          await cli.query("ROLLBACK");
          throw e;
        } finally {
          cli.release();
        }
      },
      fechar: () => pool.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const lite = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
  const embrulhar = (q: { query: typeof lite.query }): Db => ({
    query: async (sql, params) => q.query(sql, params) as never,
    transacao: (fn) => lite.transaction((tx) => fn(embrulhar(tx))),
    fechar: async () => {},
  });
  return { ...embrulhar(lite), fechar: () => lite.close() };
}

/** Chave do advisory lock da subida: várias instâncias subindo juntas migram e semeiam uma de cada vez. */
export const TRAVA_SUBIDA = 4_247_001;

export async function migrar(db: Db): Promise<void> {
  // Tudo numa transação só, com trava: a segunda instância espera e encontra as migrações feitas.
  await db.transacao(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(${TRAVA_SUBIDA})`);
    await tx.query(`CREATE TABLE IF NOT EXISTS _migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await tx.query<{ nome: string }>(`SELECT nome FROM _migracoes`);
    const feitas = new Set(rows.map((r) => r.nome));
    for (const [nome, sql] of MIGRACOES) {
      if (feitas.has(nome)) continue;
      for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await tx.query(stmt);
      await tx.query(`INSERT INTO _migracoes (nome) VALUES ($1)`, [nome]);
      console.log(`Migração aplicada: ${nome}`);
    }
  });
}
