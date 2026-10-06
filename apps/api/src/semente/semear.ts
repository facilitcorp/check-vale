import bcrypt from "bcryptjs";
import { TRAVA_SUBIDA, type Db } from "../db";
import { AREAS, ATIVIDADES, ATRIBUTOS_DEMO, TIPOS_VEICULO, UNIDADES, VEICULOS_DEMO, idDe, modeloPadrao } from "./dados";

/** Popula dados de DEMONSTRAÇÃO (demo = true) se o banco estiver vazio. Idempotente. */
export async function semearDemo(db: Db, senhaDemo: string): Promise<boolean> {
  return db.transacao(async (tx) => {
    // Mesma trava das migrações: duas instâncias subindo juntas não semeiam duas vezes.
    await tx.query(`SELECT pg_advisory_xact_lock(${TRAVA_SUBIDA})`);
    const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM unidades`);
    if ((rows[0]?.n ?? 0) > 0) return false;

    for (const u of UNIDADES) await tx.query(`INSERT INTO unidades (id, nome, uf, demo) VALUES ($1,$2,$3,true)`, [u.id, u.nome, u.uf]);
    for (const a of AREAS) await tx.query(`INSERT INTO areas (id, nome, demo) VALUES ($1,$2 || ' (DEMO)',true)`, [a.id, a.nome]);
    for (const a of ATIVIDADES) await tx.query(`INSERT INTO atividades (id, nome, demo) VALUES ($1,$2 || ' (DEMO)',true)`, [a.id, a.nome]);
    for (const t of TIPOS_VEICULO)
      await tx.query(`INSERT INTO tipos_veiculo (id, codigo, nome, ordem) VALUES ($1,$2,$3,$4)`, [t.id, t.codigo, t.nome, t.ordem]);
    for (const a of ATRIBUTOS_DEMO)
      await tx.query(
        `INSERT INTO atributos_veiculo (id, codigo, nome, tipo, opcoes, unidade_medida, tipo_veiculo_ids, obrigatorio, ordem, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [idDe(`atributo:${a.codigo}`), a.codigo, a.nome, a.tipo, a.opcoes, a.unidadeMedida, a.tipoVeiculoIds, a.obrigatorio, a.ordem, a.ativo],
      );

    const m = modeloPadrao();
    await tx.query(
      `INSERT INTO modelos_checklist (id, versao, nome, aplicavel, categorias, status, demo, publicada_em) VALUES ($1,$2,$3,$4,$5,'publicada',true,now())`,
      [m.id, m.versao, m.nome, JSON.stringify(m.aplicavel), JSON.stringify(m.categorias)],
    );

    const hash = await bcrypt.hash(senhaDemo, 10);
    const usuarios = [
      { id: idDe("usuario:inspetor"), nome: "Inspetor DEMO", email: "inspetor@checkvale.dev", papel: "inspetor" },
      { id: idDe("usuario:admin"), nome: "Admin DEMO", email: "admin@checkvale.dev", papel: "admin" },
    ];
    for (const u of usuarios)
      await tx.query(`INSERT INTO usuarios (id, nome, email, senha_hash, papel, demo) VALUES ($1,$2,$3,$4,$5,true)`, [u.id, u.nome, u.email, hash, u.papel]);

    const agora = new Date().toISOString();
    for (const v of VEICULOS_DEMO) {
      const tipo = TIPOS_VEICULO.find((t) => t.codigo === v.tipo)!;
      await tx.query(
        `INSERT INTO veiculos (id, placa, codigo, tipo_veiculo_id, descricao, fabricante, modelo, unidade_id, atributos, demo, criado_em, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$10)`,
        [idDe(`veiculo:${v.placa ?? v.codigo}`), v.placa, v.codigo ?? null, tipo.id, v.descricao, v.fabricante, v.modelo, UNIDADES[0]!.id, JSON.stringify(v.atributos), agora],
      );
    }
    return true;
  });
}
