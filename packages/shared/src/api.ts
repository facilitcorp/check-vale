import { z } from "zod";
import {
  Area, Atividade, CategoriaChecklist, DataHora, DefinicaoAtributo, Evidencia, Id, Inspecao, ModeloChecklist, Papel,
  RegraAplicabilidade, StatusVersao, TipoVeiculo, Unidade, Usuario, Veiculo, VeiculoBase,
} from "./dominio";

/**
 * Contrato HTTP app ↔ API (prefixo /api). Toda rota, exceto /auth/login,
 * /auth/cadastro e /saude, exige `Authorization: Bearer <token>`.
 *
 *   POST /api/auth/login              LoginEntrada → LoginSaida
 *   POST /api/auth/cadastro           CadastroEntrada → LoginSaida (só com AUTOCADASTRO=1)
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
  email: z.string().trim().toLowerCase().pipe(z.email()),
  senha: z.string().min(1),
});
export type LoginEntrada = z.infer<typeof LoginEntrada>;

export const LoginSaida = z.object({
  token: z.string(),
  expiraEm: DataHora,
  usuario: Usuario,
});
export type LoginSaida = z.infer<typeof LoginSaida>;

/** Autocadastro temporário, para teste: a conta nasce inspetor e já sai logada. */
export const CadastroEntrada = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  // bcrypt ignora o que passa de 72 bytes: limitar evita senha que "confere" só no começo.
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
});
export type CadastroEntrada = z.infer<typeof CadastroEntrada>;

/** GET /api/saude: o app usa `autocadastro` para mostrar ou não o "Crie seu cadastro". */
export const Saude = z.object({ ok: z.boolean(), versao: z.string(), revisao: z.string().nullable(), autocadastro: z.boolean() });
export type Saude = z.infer<typeof Saude>;

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

/** Envelope comum: opId (UUID do aparelho) garante idempotência. */
const Envelope = { opId: Id, criadaEm: DataHora };

/** Cria ou atualiza veículo (cadastro feito no app, inclusive offline). */
export const OpVeiculoSalvar = z.object({
  ...Envelope,
  tipo: z.literal("veiculo.salvar"),
  veiculo: Veiculo,
});

/**
 * Snapshot da inspeção. A API faz merge por item (vale a resposta com
 * respondidaEm mais recente) e nunca reabre uma inspeção concluída.
 */
export const OpInspecaoSalvar = z.object({
  ...Envelope,
  tipo: z.literal("inspecao.salvar"),
  inspecao: Inspecao,
});

/** Metadados da foto; o binário vai depois por PUT /evidencias/:id/arquivo. */
export const OpEvidenciaRegistrar = z.object({
  ...Envelope,
  tipo: z.literal("evidencia.registrar"),
  evidencia: Evidencia,
});

export const OperacaoSync = z.discriminatedUnion("tipo", [OpVeiculoSalvar, OpInspecaoSalvar, OpEvidenciaRegistrar]);
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

// ---------------------------------------------------------------------------
// Administração (prefixo /api/admin, permissão config:* / modelo:publicar / usuario:gerenciar)
//
//   GET|POST /admin/unidades        PATCH /admin/unidades/:id
//   GET|POST /admin/areas           PATCH /admin/areas/:id
//   GET|POST /admin/atividades      PATCH /admin/atividades/:id
//   GET|POST /admin/tipos-veiculo   PATCH /admin/tipos-veiculo/:id
//   GET|POST /admin/atributos       PATCH /admin/atributos/:id
//   GET|POST /admin/veiculos        PATCH /admin/veiculos/:id
//   GET|POST /admin/usuarios        PATCH /admin/usuarios/:id
//   GET  /admin/modelos                               → ModeloResumo[]
//   POST /admin/modelos               {nome}          → VersaoModelo (rascunho v1)
//   GET  /admin/modelos/:id/versoes/:v                → VersaoModelo
//   PUT  /admin/modelos/:id/versoes/:v RascunhoEntrada → VersaoModelo (só rascunho)
//   POST /admin/modelos/:id/rascunho                  → VersaoModelo (cópia da última, versao+1)
//   POST /admin/modelos/:id/versoes/:v/publicar       → VersaoModelo | 422 {erros}
//   POST /admin/modelos/:id/versoes/:v/previa  ContextoRegras → ModeloChecklist recortado
// Exclusão física não existe: desativa-se (ativo=false / status=inativo). Auditoria preserva o histórico.
// ---------------------------------------------------------------------------


export const UnidadeEntrada = Unidade.omit({ id: true, demo: true });
export const AreaEntrada = Area.omit({ id: true, demo: true });
export const AtividadeEntrada = Atividade.omit({ id: true, demo: true });
export const TipoVeiculoEntrada = TipoVeiculo.omit({ id: true });
export const AtributoEntrada = DefinicaoAtributo.omit({ id: true });
export const VeiculoEntrada = VeiculoBase.omit({ id: true, demo: true, criadoEm: true, atualizadoEm: true });

export const UsuarioAdmin = z.object({ id: Id, nome: z.string(), email: z.email(), papel: Papel, ativo: z.boolean(), demo: z.boolean() });
export type UsuarioAdmin = z.infer<typeof UsuarioAdmin>;
export const UsuarioEntrada = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  papel: Papel,
  ativo: z.boolean(),
  /** Obrigatória na criação; na edição, só se for trocar. */
  senha: z.string().min(8, "Senha com no mínimo 8 caracteres.").optional(),
});

export const VersaoModelo = ModeloChecklist.extend({
  status: StatusVersao,
  demo: z.boolean(),
  criadaEm: DataHora,
  publicadaEm: DataHora.nullable(),
});
export type VersaoModelo = z.infer<typeof VersaoModelo>;

export const ModeloResumo = z.object({
  id: Id,
  nome: z.string(),
  demo: z.boolean(),
  versoes: z.array(z.object({ versao: z.number().int(), status: StatusVersao, publicadaEm: DataHora.nullable(), itens: z.number().int() })),
});
export type ModeloResumo = z.infer<typeof ModeloResumo>;

export const NovoModeloEntrada = z.object({ nome: z.string().trim().min(1) });
export const RascunhoEntrada = z.object({
  nome: z.string().trim().min(1),
  aplicavel: RegraAplicabilidade,
  categorias: z.array(CategoriaChecklist),
});
export type RascunhoEntrada = z.infer<typeof RascunhoEntrada>;
