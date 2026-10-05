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

export async function migrar(db: Db): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS _migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await db.query<{ nome: string }>(`SELECT nome FROM _migracoes`);
  const feitas = new Set(rows.map((r) => r.nome));
  for (const [nome, sql] of MIGRACOES) {
    if (feitas.has(nome)) continue;
    await db.transacao(async (tx) => {
      for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await tx.query(stmt);
      await tx.query(`INSERT INTO _migracoes (nome) VALUES ($1)`, [nome]);
    });
  }
}
