import { z } from "zod";
import { DataHora, Evidencia, Id, Inspecao, Usuario, Veiculo } from "./dominio";

/**
 * Contrato HTTP app ↔ API (prefixo /api). Toda rota, exceto /auth/login e
 * /saude, exige `Authorization: Bearer <token>`.
 *
 *   POST /api/auth/login              LoginEntrada → LoginSaida
 *   GET  /api/auth/eu                 → Usuario
 *   GET  /api/catalogo                → Catalogo (ETag = catalogo.versao)
 *   GET  /api/veiculos?desde=<iso>    → { veiculos: Veiculo[], servidorEm }
 *   GET  /api/inspecoes?desde=<iso>   → { inspecoes: Inspecao[], servidorEm } (do próprio inspetor)
 *   POST /api/sync                    SyncEntrada → SyncSaida
 *   PUT  /api/evidencias/:id/arquivo  corpo binário (Content-Type image/*) → { url }
 *   GET  /api/evidencias/:id/arquivo  → binário
 *   GET  /api/inspecoes/:id/relatorio.pdf → PDF
 *
 * Offline-first: o app grava tudo localmente e empilha operações numa fila.
 * Com rede, envia a fila em lotes para /sync. Cada operação tem opId (UUID);
 * a API registra opIds aplicados e ignora repetidos — reenviar é seguro.
 */

export const LoginEntrada = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  senha: z.string().min(1),
});
export type LoginEntrada = z.infer<typeof LoginEntrada>;

export const LoginSaida = z.object({
  token: z.string(),
  expiraEm: DataHora,
  usuario: Usuario,
});
export type LoginSaida = z.infer<typeof LoginSaida>;

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

/** Cria ou atualiza veículo (cadastro feito no app, inclusive offline). */
export const OpVeiculoSalvar = z.object({
  tipo: z.literal("veiculo.salvar"),
  veiculo: Veiculo,
});

/**
 * Snapshot da inspeção. A API faz merge por item (vale a resposta com
 * respondidaEm mais recente) e nunca reabre uma inspeção concluída.
 */
export const OpInspecaoSalvar = z.object({
  tipo: z.literal("inspecao.salvar"),
  inspecao: Inspecao,
});

/** Metadados da foto; o binário vai depois por PUT /evidencias/:id/arquivo. */
export const OpEvidenciaRegistrar = z.object({
  tipo: z.literal("evidencia.registrar"),
  evidencia: Evidencia,
});

export const OperacaoSync = z
  .discriminatedUnion("tipo", [OpVeiculoSalvar, OpInspecaoSalvar, OpEvidenciaRegistrar])
  .and(z.object({ opId: Id, criadaEm: DataHora }));
export type OperacaoSync = z.infer<typeof OperacaoSync>;

export const SyncEntrada = z.object({
  dispositivoId: Id,
  operacoes: z.array(OperacaoSync).min(1).max(100),
});
export type SyncEntrada = z.infer<typeof SyncEntrada>;

export const ResultadoOp = z.object({
  opId: Id,
  /** aplicada = gravou agora; duplicada = já tinha sido aplicada; rejeitada = erro permanente (não reenviar). */
  status: z.enum(["aplicada", "duplicada", "rejeitada"]),
  erro: z.string().nullable(),
});
export type ResultadoOp = z.infer<typeof ResultadoOp>;

export const SyncSaida = z.object({
  resultados: z.array(ResultadoOp),
  servidorEm: DataHora,
});
export type SyncSaida = z.infer<typeof SyncSaida>;

/** Corpo padrão de erro da API. */
export const ErroApi = z.object({
  erro: z.string(), // código estável, ex.: "credenciais_invalidas"
  mensagem: z.string(), // texto para o usuário, em PT-BR
});
export type ErroApi = z.infer<typeof ErroApi>;
