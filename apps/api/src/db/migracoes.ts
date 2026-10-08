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

  [
    "002_nucleo_configuravel",
    `
-- Perfis: admin e inspetor (RBAC por permissão no código). gestor do MVP vira admin.
UPDATE usuarios SET papel = 'admin' WHERE papel = 'gestor';
ALTER TABLE usuarios DROP CONSTRAINT usuarios_papel_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_check CHECK (papel IN ('admin','inspetor'));
ALTER TABLE usuarios ADD COLUMN demo boolean NOT NULL DEFAULT false;

-- Operação: marca de demonstração e UF opcional.
ALTER TABLE unidades ALTER COLUMN uf DROP NOT NULL;
ALTER TABLE unidades ADD COLUMN demo boolean NOT NULL DEFAULT false;
ALTER TABLE areas ADD COLUMN demo boolean NOT NULL DEFAULT false;
ALTER TABLE atividades ADD COLUMN demo boolean NOT NULL DEFAULT false;
ALTER TABLE tipos_veiculo ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Atributos técnicos configuráveis (sem coluna fixa por tipo de veículo).
CREATE TABLE atributos_veiculo (
  id uuid PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto','numero','booleano','lista')),
  opcoes text[] NOT NULL DEFAULT '{}',
  unidade_medida text,
  tipo_veiculo_ids uuid[] NOT NULL DEFAULT '{}',
  obrigatorio boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);

-- Veículo: fabricante/modelo separados, empresa, status e atributos.
ALTER TABLE veiculos ADD COLUMN fabricante text NOT NULL DEFAULT '';
ALTER TABLE veiculos ADD COLUMN modelo text NOT NULL DEFAULT '';
ALTER TABLE veiculos ADD COLUMN empresa text;
ALTER TABLE veiculos ADD COLUMN status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo'));
ALTER TABLE veiculos ADD COLUMN atributos jsonb NOT NULL DEFAULT '{}';
ALTER TABLE veiculos ADD COLUMN demo boolean NOT NULL DEFAULT false;
UPDATE veiculos SET modelo = marca_modelo;
ALTER TABLE veiculos DROP COLUMN marca_modelo;
ALTER TABLE veiculos ALTER COLUMN descricao SET DEFAULT '';
ALTER TABLE veiculos ALTER COLUMN criado_em SET DEFAULT now();
ALTER TABLE veiculos ALTER COLUMN atualizado_em SET DEFAULT now();
ALTER TABLE veiculos ADD CONSTRAINT veiculos_placa_ou_codigo CHECK (placa IS NOT NULL OR codigo IS NOT NULL);

-- Modelo: ciclo rascunho → publicada → arquivada; regra de aplicabilidade em JSON.
ALTER TABLE modelos_checklist ADD COLUMN status text NOT NULL DEFAULT 'publicada' CHECK (status IN ('rascunho','publicada','arquivada'));
ALTER TABLE modelos_checklist ADD COLUMN aplicavel jsonb;
UPDATE modelos_checklist SET aplicavel = jsonb_build_object(
  'tipoVeiculoIds', to_jsonb(tipo_veiculo_ids), 'areaIds', to_jsonb(area_ids), 'atividadeIds', to_jsonb(atividade_ids), 'atributos', '[]'::jsonb);
ALTER TABLE modelos_checklist ALTER COLUMN aplicavel SET NOT NULL;
ALTER TABLE modelos_checklist DROP COLUMN tipo_veiculo_ids;
ALTER TABLE modelos_checklist DROP COLUMN area_ids;
ALTER TABLE modelos_checklist DROP COLUMN atividade_ids;
ALTER TABLE modelos_checklist DROP COLUMN ativo;
ALTER TABLE modelos_checklist ADD COLUMN demo boolean NOT NULL DEFAULT false;
ALTER TABLE modelos_checklist ADD COLUMN publicada_em timestamptz;
ALTER TABLE modelos_checklist ADD COLUMN publicada_por uuid REFERENCES usuarios(id);
UPDATE modelos_checklist SET publicada_em = criado_em WHERE status = 'publicada';
-- No máximo um rascunho aberto por modelo.
CREATE UNIQUE INDEX modelos_um_rascunho ON modelos_checklist (id) WHERE status = 'rascunho';

-- Retrato dos atributos do veículo no momento da inspeção (regras usam este).
ALTER TABLE inspecoes ADD COLUMN atributos_veiculo jsonb NOT NULL DEFAULT '{}';
ALTER TABLE inspecoes ADD COLUMN tipo_veiculo_id uuid REFERENCES tipos_veiculo(id);
UPDATE inspecoes i SET tipo_veiculo_id = v.tipo_veiculo_id FROM veiculos v WHERE v.id = i.veiculo_id;
ALTER TABLE inspecoes ALTER COLUMN tipo_veiculo_id SET NOT NULL;
`,
  ],
  [
    "003_biblioteca",
    `
-- Biblioteca de checklists por setor (docs/BIBLIOTECA.md). Setor é cadastro, sem limite de quantidade.
CREATE TABLE setores (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  icone text NOT NULL DEFAULT 'geral',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Catálogo. Não existe origem "oficial": base_checkvale ou referência (com fonte).
CREATE TABLE biblioteca_modelos (
  id uuid NOT NULL,
  versao int NOT NULL,
  setor_ids uuid[] NOT NULL,
  nome text NOT NULL,
  resumo text NOT NULL DEFAULT '',
  origem text NOT NULL CHECK (origem IN ('base_checkvale','referencia')),
  fonte text,
  categorias jsonb NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada','arquivada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  publicada_em timestamptz,
  publicada_por uuid REFERENCES usuarios(id),
  PRIMARY KEY (id, versao),
  CHECK (origem <> 'referencia' OR coalesce(trim(fonte), '') <> '')
);
CREATE UNIQUE INDEX biblioteca_um_rascunho ON biblioteca_modelos (id) WHERE status = 'rascunho';

-- Checklist da empresa guarda de onde foi copiado.
ALTER TABLE modelos_checklist ADD COLUMN biblioteca_modelo_id uuid;
ALTER TABLE modelos_checklist ADD COLUMN biblioteca_versao int;

-- Taxonomia inicial. Administrável em /admin/setores; ícone é chave desenhada pela tela.
INSERT INTO setores (id, nome, icone, ordem) VALUES
  (gen_random_uuid(), 'Mineração', 'picareta', 10),
  (gen_random_uuid(), 'Energia elétrica', 'raio', 20),
  (gen_random_uuid(), 'Transporte rodoviário e logística', 'caminhao', 30),
  (gen_random_uuid(), 'Construção civil e infraestrutura', 'predio', 40),
  (gen_random_uuid(), 'Óleo, gás e petroquímica', 'chama', 50),
  (gen_random_uuid(), 'Agronegócio', 'trator', 60),
  (gen_random_uuid(), 'Portos e terminais', 'navio', 70),
  (gen_random_uuid(), 'Transporte de passageiros', 'onibus', 80),
  (gen_random_uuid(), 'Indústria e siderurgia', 'fabrica', 90),
  (gen_random_uuid(), 'Saneamento, resíduos e serviços ambientais', 'reciclagem', 100);
`,
  ],
  [
    "004_sync_rejeicao",
    `
-- Rejeição do /sync com código e detalhe: o reenvio da mesma operação responde igual.
ALTER TABLE sync_ops ADD COLUMN codigo text;
ALTER TABLE sync_ops ADD COLUMN detalhes jsonb;
`,
  ],
];
