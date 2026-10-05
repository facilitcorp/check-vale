/**
 * Migrações em ordem. NUNCA editar uma migração já publicada: crie a próxima.
 * Separador de comandos: ";" no fim da linha.
 */
export const MIGRACOES: [string, string][] = [
  [
    "001_inicial",
    `
CREATE TABLE usuarios (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('inspetor','gestor','admin')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE unidades (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  uf char(2) NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE areas (
  id uuid PRIMARY KEY,
  unidade_id uuid REFERENCES unidades(id),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE atividades (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE tipos_veiculo (
  id uuid PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0
);

-- Modelo versionado: (id, versao) é imutável depois de publicado.
CREATE TABLE modelos_checklist (
  id uuid NOT NULL,
  versao int NOT NULL,
  nome text NOT NULL,
  tipo_veiculo_ids uuid[] NOT NULL DEFAULT '{}',
  area_ids uuid[] NOT NULL DEFAULT '{}',
  atividade_ids uuid[] NOT NULL DEFAULT '{}',
  categorias jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, versao)
);

CREATE TABLE veiculos (
  id uuid PRIMARY KEY,
  placa text,
  codigo text,
  tipo_veiculo_id uuid NOT NULL REFERENCES tipos_veiculo(id),
  descricao text NOT NULL,
  marca_modelo text NOT NULL DEFAULT '',
  unidade_id uuid REFERENCES unidades(id),
  criado_por uuid REFERENCES usuarios(id),
  criado_em timestamptz NOT NULL,
  atualizado_em timestamptz NOT NULL,
  servidor_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX veiculos_placa_uq ON veiculos (upper(placa)) WHERE placa IS NOT NULL;
CREATE INDEX veiculos_servidor_em ON veiculos (servidor_em);

CREATE TABLE inspecoes (
  id uuid PRIMARY KEY,
  modelo_id uuid NOT NULL,
  modelo_versao int NOT NULL,
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  area_id uuid NOT NULL REFERENCES areas(id),
  atividade_id uuid NOT NULL REFERENCES atividades(id),
  veiculo_id uuid NOT NULL REFERENCES veiculos(id),
  inspetor_id uuid NOT NULL REFERENCES usuarios(id),
  status text NOT NULL CHECK (status IN ('em_andamento','concluida','cancelada')),
  iniciada_em timestamptz NOT NULL,
  concluida_em timestamptz,
  indice int,
  situacao text,
  servidor_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (modelo_id, modelo_versao) REFERENCES modelos_checklist(id, versao)
);
CREATE INDEX inspecoes_inspetor ON inspecoes (inspetor_id, servidor_em);
CREATE INDEX inspecoes_veiculo ON inspecoes (veiculo_id);

CREATE TABLE respostas (
  inspecao_id uuid NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('conforme','nao_conforme','nao_aplica')),
  observacao text,
  nc_descricao text,
  nc_criticidade text CHECK (nc_criticidade IN ('critica','alta','media','baixa')),
  evidencia_ids uuid[] NOT NULL DEFAULT '{}',
  respondida_em timestamptz NOT NULL,
  PRIMARY KEY (inspecao_id, item_id)
);

CREATE TABLE evidencias (
  id uuid PRIMARY KEY,
  inspecao_id uuid NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  mime text NOT NULL,
  bytes int NOT NULL,
  capturada_em timestamptz NOT NULL,
  arquivo_chave text,
  enviada_em timestamptz,
  registrada_por uuid NOT NULL REFERENCES usuarios(id)
);

-- Idempotência da sincronização.
CREATE TABLE sync_ops (
  op_id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  dispositivo_id uuid NOT NULL,
  tipo text NOT NULL,
  status text NOT NULL,
  erro text,
  recebida_em timestamptz NOT NULL DEFAULT now()
);

-- Trilha de auditoria: só INSERT.
CREATE TABLE auditoria (
  id bigserial PRIMARY KEY,
  usuario_id uuid,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  dados jsonb,
  ip text,
  em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_entidade ON auditoria (entidade, entidade_id);
`,
  ],
];
