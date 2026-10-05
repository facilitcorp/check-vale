import { defineConfig } from "vitest/config";

// PGlite (Postgres em WASM) leva alguns segundos para subir.
export default defineConfig({ test: { hookTimeout: 60_000, testTimeout: 30_000 } });
