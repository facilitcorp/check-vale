import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/servidor.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // O pacote compartilhado é TS puro: entra no bundle.
  noExternal: ["@checkvale/shared"],
  define: { __VERSAO__: JSON.stringify(version) },
});
