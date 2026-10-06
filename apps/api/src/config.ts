import { randomBytes } from "node:crypto";

/** Configuração só por variável de ambiente. Nada de segredo no código. */
export interface Config {
  producao: boolean;
  porta: number;
  /** postgres://... em produção; vazio = PGlite (em memória ou em DATA_DIR). */
  databaseUrl: string | null;
  dataDir: string | null;
  jwtSecret: string;
  jwtValidade: string;
  /** Diretório local das fotos (MVP). Em nuvem será trocado por bucket. */
  uploadsDir: string;
  /** Bucket do Cloud Storage para as fotos. Se definido, substitui uploadsDir. */
  uploadsBucket: string | null;
  /** Build da PWA (apps/web/dist). Se definido, a API serve o app na mesma origem. */
  webDir: string | null;
  origensCors: string[];
  /** Cria catálogo e usuário de demonstração se o banco estiver vazio. */
  semearDemo: boolean;
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const producao = env.NODE_ENV === "production";
  const jwtSecret = env.JWT_SECRET ?? (producao ? "" : randomBytes(32).toString("hex"));
  if (producao && jwtSecret.length < 32) throw new Error("JWT_SECRET ausente ou curto (mínimo 32 caracteres).");
  return {
    producao,
    porta: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL || null,
    dataDir: env.DATA_DIR || null,
    jwtSecret,
    jwtValidade: env.JWT_VALIDADE ?? "12h",
    uploadsDir: env.UPLOADS_DIR ?? "./uploads",
    uploadsBucket: env.UPLOADS_BUCKET || null,
    webDir: env.WEB_DIR || null,
    origensCors: (env.CORS_ORIGENS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    semearDemo: env.SEMEAR_DEMO ? env.SEMEAR_DEMO === "1" : !producao,
  };
}
