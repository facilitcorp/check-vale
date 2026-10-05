// Configuração comum dos roteiros de tela. Tudo por variável de ambiente; os padrões batem com o README.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.WEB ?? 'http://localhost:5199';
export const API = process.env.API ?? 'http://localhost:3100/api';
export const SAIDA = process.env.SAIDA ?? join(dirname(fileURLToPath(import.meta.url)), 'saida');
mkdirSync(SAIDA, { recursive: true });
export const em = (arquivo) => join(SAIDA, arquivo);

// Ids criados pelo aceite-admin.mjs (a saída dele, redirecionada para este arquivo).
export function idsDoAdmin() {
  const arq = process.env.IDS_ADMIN ?? em('aceite-admin.json');
  if (!existsSync(arq)) throw new Error(`Falta ${arq}: rode antes "node qa/aceite-admin.mjs > ${arq}"`);
  return JSON.parse(readFileSync(arq, 'utf8')).ids;
}

export function pastaDeUploads() {
  const d = process.env.UPLOADS_DIR;
  if (!d) throw new Error('Defina UPLOADS_DIR com a mesma pasta de uploads da API');
  return d;
}
