import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/servidor.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // O pacote compartilhado é TS puro: entra no bundle.
  noExternal: ["@checkvale/shared"],
});
