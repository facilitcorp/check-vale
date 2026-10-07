import { armazenamentoLocal } from "./armazenamento";
import { armazenamentoBucket } from "./armazenamento-bucket";
import { criarApp } from "./app";
import { lerConfig } from "./config";
import { abrirDb, migrar } from "./db";
import { carregarBiblioteca } from "./semente/biblioteca";
import { MODELOS_BIBLIOTECA } from "./semente/biblioteca-conteudo";
import { semearDemo } from "./semente/semear";

try {
  const cfg = lerConfig();
  console.log(`CheckVale ${cfg.versao}${cfg.revisao ? ` (${cfg.revisao})` : ""} subindo: banco ${cfg.databaseUrl ? "Postgres" : "PGlite"}, fotos ${cfg.uploadsBucket ? `no bucket ${cfg.uploadsBucket}` : `em ${cfg.uploadsDir}`}.`);
  const db = await abrirDb(cfg);
  await migrar(db);
  // Conteúdo do produto (não é DEMO): todo ambiente recebe os modelos base que ainda não tem
  // e a versão nova dos que a curadoria ainda não assumiu.
  const biblioteca = await carregarBiblioteca(db, MODELOS_BIBLIOTECA);
  if (biblioteca.inseridos > 0) console.log(`Biblioteca: ${biblioteca.inseridos} modelo(s) base publicado(s).`);
  if (biblioteca.atualizados > 0) console.log(`Biblioteca: ${biblioteca.atualizados} modelo(s) base com versão nova publicada.`);
  if (biblioteca.pulados.length > 0) console.warn(`Biblioteca: setor não encontrado, modelos pulados: ${biblioteca.pulados.join(", ")}.`);
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
