import { armazenamentoLocal } from "./armazenamento";
import { armazenamentoBucket } from "./armazenamento-bucket";
import { criarApp } from "./app";
import { lerConfig } from "./config";
import { abrirDb, migrar } from "./db";
import { semearDemo } from "./semente/semear";

try {
  const cfg = lerConfig();
  console.log(`CheckVale ${cfg.versao}${cfg.revisao ? ` (${cfg.revisao})` : ""} subindo: banco ${cfg.databaseUrl ? "Postgres" : "PGlite"}, fotos ${cfg.uploadsBucket ? `no bucket ${cfg.uploadsBucket}` : `em ${cfg.uploadsDir}`}.`);
  const db = await abrirDb(cfg);
  await migrar(db);
  if (cfg.semearDemo && (await semearDemo(db, cfg.senhaDemo))) {
    console.log("Banco vazio: catálogo e usuários de demonstração criados (inspetor@checkvale.dev).");
  }
  const app = await criarApp(cfg, db, cfg.uploadsBucket ? armazenamentoBucket(cfg.uploadsBucket) : armazenamentoLocal(cfg.uploadsDir));
  await app.listen({ port: cfg.porta, host: "0.0.0.0" });
  console.log(`CheckVale API em http://localhost:${cfg.porta}${cfg.databaseUrl ? "" : " (PGlite)"}`);

  for (const sinal of ["SIGINT", "SIGTERM"] as const)
    process.on(sinal, async () => {
      await app.close();
      await db.fechar();
      process.exit(0);
    });
} catch (e) {
  // Uma linha só, legível no Cloud Logging: configuração faltando ou banco inacessível.
  console.error(JSON.stringify({ severity: "CRITICAL", message: `CheckVale não subiu: ${(e as Error).message}` }));
  process.exit(1);
}
