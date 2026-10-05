import bcrypt from "bcryptjs";
import type { Db } from "../db";
import { AREAS, ATIVIDADES, TIPOS_VEICULO, UNIDADES, VEICULOS_DEMO, idDe, modeloPadrao } from "./dados";

/** Popula catálogo e usuários de demonstração se o banco estiver vazio. Idempotente. */
export async function semearDemo(db: Db, senhaDemo: string): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM unidades`);
  if ((rows[0]?.n ?? 0) > 0) return false;

  await db.transacao(async (tx) => {
    for (const u of UNIDADES) await tx.query(`INSERT INTO unidades (id, nome, uf) VALUES ($1,$2,$3)`, [u.id, u.nome, u.uf]);
    for (const a of AREAS) await tx.query(`INSERT INTO areas (id, nome) VALUES ($1,$2)`, [a.id, a.nome]);
    for (const a of ATIVIDADES) await tx.query(`INSERT INTO atividades (id, nome) VALUES ($1,$2)`, [a.id, a.nome]);
    for (const t of TIPOS_VEICULO)
      await tx.query(`INSERT INTO tipos_veiculo (id, codigo, nome, ordem) VALUES ($1,$2,$3,$4)`, [t.id, t.codigo, t.nome, t.ordem]);

    const m = modeloPadrao();
    await tx.query(
      `INSERT INTO modelos_checklist (id, versao, nome, tipo_veiculo_ids, area_ids, atividade_ids, categorias) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [m.id, m.versao, m.nome, m.tipoVeiculoIds, m.areaIds, m.atividadeIds, JSON.stringify(m.categorias)],
    );

    const hash = await bcrypt.hash(senhaDemo, 10);
    const usuarios = [
      { id: idDe("usuario:inspetor"), nome: "Inspetor Demonstração", email: "inspetor@checkvale.dev", papel: "inspetor" },
      { id: idDe("usuario:gestor"), nome: "Gestor Demonstração", email: "gestor@checkvale.dev", papel: "gestor" },
    ];
    for (const u of usuarios)
      await tx.query(`INSERT INTO usuarios (id, nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4,$5)`, [u.id, u.nome, u.email, hash, u.papel]);

    const agora = new Date().toISOString();
    for (const v of VEICULOS_DEMO) {
      const tipo = TIPOS_VEICULO.find((t) => t.codigo === v.tipo)!;
      await tx.query(
        `INSERT INTO veiculos (id, placa, codigo, tipo_veiculo_id, descricao, marca_modelo, unidade_id, criado_em, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [idDe(`veiculo:${v.placa ?? v.codigo}`), v.placa, v.codigo ?? null, tipo.id, v.descricao, v.marcaModelo, UNIDADES[0]!.id, agora],
      );
    }
  });
  return true;
}
