// Aceite MVP — Parte 1 (Admin), direto na API local. Cada passo registra PASSOU/FALHOU com evidência.
const B = process.env.API ?? "http://localhost:3100/api";
const res = [];
const ok = (passo, cond, ev = "") => { res.push({ passo, r: cond ? "PASSOU" : "FALHOU", ev }); };
async function req(tok, met, cam, corpo) {
  const r = await fetch(B + cam, { method: met, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(corpo ? { "content-type": "application/json" } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
const login = async (email, senha) => (await req(null, "POST", "/auth/login", { email, senha }));

// 1. Login ADMIN
const la = await login("admin@checkvale.dev", "checkvale");
ok("1 login admin", la.s === 200 && la.j.usuario.papel === "admin", `${la.s} papel=${la.j?.usuario?.papel}`);
const A = la.j.token;

// 2. Operação
const u = await req(A, "POST", "/admin/unidades", { nome: "Complexo DEMO Aceite", uf: "MG", ativo: true });
ok("2 criar site/complexo", u.s === 201, `${u.s} demo=${u.j?.demo}`);
const ar = await req(A, "POST", "/admin/areas", { unidadeId: u.j.id, nome: "Área DEMO Mina Norte", ativo: true });
ok("2 criar área", ar.s === 201, `${ar.s}`);
const ar2 = await req(A, "POST", "/admin/areas", { unidadeId: u.j.id, nome: "Área DEMO Usina", ativo: true });
const at = await req(A, "POST", "/admin/atividades", { nome: "Atividade DEMO Transporte", ativo: true });
ok("2 criar atividade", at.s === 201, `${at.s}`);
const ed = await req(A, "PATCH", `/admin/areas/${ar.j.id}`, { nome: "Área DEMO Mina Norte (editada)" });
ok("2 editar área", ed.s === 200 && ed.j.nome.endsWith("(editada)"), `${ed.s} ${ed.j?.nome}`);
const atTmp = await req(A, "POST", "/admin/atividades", { nome: "Atividade DEMO Temporária", ativo: true });
const des = await req(A, "PATCH", `/admin/atividades/${atTmp.j.id}`, { ativo: false });
const cat0 = await req(A, "GET", "/catalogo");
ok("2 desativar (some do catálogo do app)", des.s === 200 && des.j.ativo === false && !cat0.j.atividades.some((x) => x.id === atTmp.j.id), `${des.s} ativo=${des.j?.ativo}`);

// 3. Frota
const tv = await req(A, "POST", "/admin/tipos-veiculo", { codigo: "caminhao_demo", nome: "Caminhão DEMO", ordem: 90, ativo: true });
ok("3 criar tipo de veículo", tv.s === 201, `${tv.s}`);
const T = tv.j.id;
const mkAt = (codigo, nome, tipo, extra = {}) => req(A, "POST", "/admin/atributos", { codigo, nome, tipo, opcoes: [], unidadeMedida: null, tipoVeiculoIds: [T], obrigatorio: false, ordem: 0, ativo: true, ...extra });
const a1 = await mkAt("cor_cabine", "Cor da cabine", "texto");
const a2 = await mkAt("eixos", "Número de eixos", "numero", { unidadeMedida: "eixos", obrigatorio: true });
const a3 = await mkAt("possui_reboque", "Possui reboque", "booleano");
const a4 = await mkAt("freio_demo", "Tipo de freio", "lista", { opcoes: ["ar", "hidraulico"] });
ok("3 atributos texto/número/sim-não/lista", [a1, a2, a3, a4].every((x) => x.s === 201), [a1, a2, a3, a4].map((x) => x.s).join(","));
const a5 = await mkAt("lista_vazia", "Lista sem opções", "lista");
ok("3 lista sem opções é recusada", a5.s === 400, `${a5.s}`);
const vBase = { codigo: null, tipoVeiculoId: T, fabricante: "Volvo", modelo: "FH 540", descricao: "Caminhão DEMO", empresa: "Facilit DEMO", unidadeId: u.j.id, status: "ativo" };
const v1 = await req(A, "POST", "/admin/veiculos", { ...vBase, placa: "dem-1a01", atributos: { cor_cabine: "branca", eixos: 3, possui_reboque: true, freio_demo: "ar" } });
ok("3 cadastrar veículo com atributos", v1.s === 201, `${v1.s} placa=${v1.j?.placa}`);
const v2 = await req(A, "POST", "/admin/veiculos", { ...vBase, placa: "DEM1A02", modelo: "FMX 460", atributos: { cor_cabine: "amarela", eixos: 2, possui_reboque: false, freio_demo: "hidraulico" } });
const vInv = await req(A, "POST", "/admin/veiculos", { ...vBase, placa: "DEM1A03", atributos: { eixos: "três", freio_demo: "disco" } });
ok("3 atributo inválido é recusado", vInv.s === 400, `${vInv.s} ${vInv.j?.mensagem}`);
const vSemObr = await req(A, "POST", "/admin/veiculos", { ...vBase, placa: "DEM1A04", atributos: {} });
ok("3 atributo obrigatório é exigido", vSemObr.s === 400, `${vSemObr.s} ${vSemObr.j?.mensagem}`);
const ve = await req(A, "PATCH", `/admin/veiculos/${v1.j.id}`, { modelo: "FH 540 6x4", atributos: { cor_cabine: "prata", eixos: 3, possui_reboque: true, freio_demo: "ar" } });
ok("3 editar veículo", ve.s === 200 && ve.j.modelo === "FH 540 6x4" && ve.j.atributos.cor_cabine === "prata", `${ve.s}`);
ok("3 fabricante + modelo", ve.j.fabricante === "Volvo" && ve.j.modelo === "FH 540 6x4", `${ve.j.fabricante} ${ve.j.modelo}`);
ok("3 atributos gravados com tipo certo", ve.j.atributos.eixos === 3 && ve.j.atributos.possui_reboque === true && ve.j.atributos.freio_demo === "ar", JSON.stringify(ve.j.atributos));
const frota = (await req(A, "GET", "/admin/veiculos")).j;
ok("3 selo DEMO nos veículos de demonstração (semente)", frota.some((v) => v.demo === true), `demo=${frota.filter((v) => v.demo).length} de ${frota.length}`);
ok("3 veículo criado pelo admin marcado DEMO", ve.j.demo === true, `demo=${ve.j.demo} (contrato não aceita demo na entrada)`);

// 4. Usuários
const ui = await req(A, "POST", "/admin/usuarios", { nome: "Inspetor Aceite", email: "inspetor.aceite@checkvale.dev", papel: "inspetor", ativo: true, senha: "aceite-2026" });
ok("4 criar usuário inspetor", ui.s === 201 && ui.j.papel === "inspetor", `${ui.s}`);
const li = await login("inspetor.aceite@checkvale.dev", "aceite-2026");
ok("4 inspetor novo faz login", li.s === 200, `${li.s}`);
const I = li.j.token;
const proib = await Promise.all(["/admin/unidades", "/admin/veiculos", "/admin/usuarios", "/admin/modelos"].map((c) => req(I, "GET", c)));
const proibW = await req(I, "POST", "/admin/unidades", { nome: "x", uf: null, ativo: true });
ok("4 API 403 para inspetor em /admin", proib.every((x) => x.s === 403) && proibW.s === 403, [...proib, proibW].map((x) => x.s).join(","));
ok("4 admin acessa /admin pela API", (await req(A, "GET", "/admin/usuarios")).s === 200, "200");

// 5. Checklist
const m = await req(A, "POST", "/admin/modelos", { nome: "Checklist DEMO Aceite" });
ok("5 criar modelo", m.s === 201 && m.j.status === "rascunho" && m.j.versao === 1, `${m.s} demo=${m.j?.demo}`);
const SR = { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] };
const id = () => crypto.randomUUID();
const item = (codigo, titulo, extra = {}) => ({ id: id(), codigo, titulo, descricao: "", ordem: 0, permiteNaoAplica: false, criticidadeSugerida: null, aplicavel: SR, ...extra });
const rascunho = {
  nome: "Checklist DEMO Aceite",
  aplicavel: { ...SR, tipoVeiculoIds: [T] },
  categorias: [
    { id: id(), codigo: "cab", nome: "Cabine", icone: "cabine", ordem: 0, aplicavel: SR, itens: [
      item("cinto", "Cinto de segurança", { criticidadeSugerida: "critica" }),
      item("ar_cond", "Ar-condicionado", { permiteNaoAplica: true, criticidadeSugerida: "baixa", ordem: 1 }),
    ] },
    { id: id(), codigo: "eng", nome: "Engate", icone: "operacao", ordem: 1, aplicavel: SR, itens: [
      item("engate_reboque", "Engate do reboque", { aplicavel: { ...SR, atributos: [{ atributo: "possui_reboque", operador: "igual", valor: true }] } }),
      item("freio_ar", "Drenar reservatório de ar", { ordem: 1, aplicavel: { ...SR, atributos: [{ atributo: "freio_demo", operador: "igual", valor: "ar" }] } }),
      item("pneus", "Pneus", { ordem: 2 }),
    ] },
  ],
};
const put = await req(A, "PUT", `/admin/modelos/${m.j.id}/versoes/1`, rascunho);
ok("5 categorias, itens, N/A, criticidade e regra salvos", put.s === 200 && put.j.categorias.length === 2, `${put.s}`);

// 6. Prévia
const ctx = (attrs) => ({ tipoVeiculoId: T, areaId: ar.j.id, atividadeId: at.j.id, atributos: attrs });
const p1 = await req(A, "POST", `/admin/modelos/${m.j.id}/versoes/1/previa`, ctx(ve.j.atributos));
const p2 = await req(A, "POST", `/admin/modelos/${m.j.id}/versoes/1/previa`, ctx(v2.j.atributos));
const cods = (p) => p.j.categorias.flatMap((c) => c.itens.map((i) => i.codigo));
ok("6 prévia veículo 1 (reboque, freio a ar)", p1.s === 200 && cods(p1).includes("engate_reboque") && cods(p1).includes("freio_ar"), cods(p1).join(","));
ok("6 prévia veículo 2: item fora da regra não aparece", p2.s === 200 && !cods(p2).includes("engate_reboque") && !cods(p2).includes("freio_ar") && cods(p2).includes("pneus"), cods(p2).join(","));
const mInv = await req(A, "POST", "/admin/modelos", { nome: "Checklist DEMO Inválido" });
await req(A, "PUT", `/admin/modelos/${mInv.j.id}/versoes/1`, { nome: "Checklist DEMO Inválido", aplicavel: SR, categorias: [
  { id: id(), codigo: "x", nome: "Vazia", icone: "", ordem: 0, aplicavel: SR, itens: [] },
  { id: id(), codigo: "y", nome: "Regra quebrada", icone: "", ordem: 1, aplicavel: SR, itens: [item("z", "Z", { aplicavel: { ...SR, atributos: [{ atributo: "nao_existe", operador: "igual", valor: "1" }] } })] },
] });
const pubInv = await req(A, "POST", `/admin/modelos/${mInv.j.id}/versoes/1/publicar`);
ok("6 publicação inválida bloqueada", pubInv.s === 422, `${pubInv.s} ${JSON.stringify(pubInv.j?.erros)}`);
const mVazio = await req(A, "POST", "/admin/modelos", { nome: "Checklist DEMO Vazio" });
const pubVazio = await req(A, "POST", `/admin/modelos/${mVazio.j.id}/versoes/1/publicar`);
ok("6 modelo sem categoria bloqueado", pubVazio.s === 422, `${pubVazio.s}`);

// 7. Publicar V1
const pubI = await req(I, "POST", `/admin/modelos/${m.j.id}/versoes/1/publicar`);
ok("7 inspetor não publica (403)", pubI.s === 403, `${pubI.s}`);
const pub = await req(A, "POST", `/admin/modelos/${m.j.id}/versoes/1/publicar`);
ok("7 publicar V1", pub.s === 200 && pub.j.status === "publicada", `${pub.s} ${pub.j?.status}`);
const alt = await req(A, "PUT", `/admin/modelos/${m.j.id}/versoes/1`, { ...rascunho, nome: "mudado" });
const rep = await req(A, "POST", `/admin/modelos/${m.j.id}/versoes/1/publicar`);
const v1Depois = await req(A, "GET", `/admin/modelos/${m.j.id}/versoes/1`);
ok("7 V1 imutável", alt.s === 409 && rep.s === 409 && v1Depois.j.nome === "Checklist DEMO Aceite", `PUT=${alt.s} republicar=${rep.s}`);
const nr = await req(A, "POST", `/admin/modelos/${m.j.id}/rascunho`);
ok("7 alterar exige novo rascunho (V2)", nr.s === 201 && nr.j.versao === 2 && nr.j.status === "rascunho", `${nr.s} v${nr.j?.versao}`);
const catI = await req(I, "GET", "/catalogo");
const noCat = catI.j?.modelos?.find((x) => x.id === m.j.id);
ok("7 inspetor recebe V1 no catálogo", catI.s === 200 && noCat?.versao === 1, `${catI.s} versao=${noCat?.versao}`);
ok("7 rascunho V2 não chega ao inspetor", !catI.j.modelos.some((x) => x.id === mInv.j.id) && noCat?.versao === 1, "");
const vI = await req(I, "GET", "/veiculos");
const lista = Array.isArray(vI.j) ? vI.j : vI.j?.veiculos ?? vI.j?.itens ?? [];
ok("7 inspetor recebe os veículos", vI.s === 200 && lista.some((v) => v.id === v1.j.id), `${vI.s} n=${lista.length}`);
ok("7 dados DEMO da semente seguem DEMO", lista.some((v) => v.demo) && catI.j.unidades.some((x) => x.demo), `veiculos demo=${lista.filter((v) => v.demo).length} unidades demo=${catI.j.unidades.filter((x) => x.demo).length}`);
const modelosAdm = (await req(A, "GET", "/admin/modelos")).j;
ok("7 modelo criado pelo admin marcado DEMO", modelosAdm.find((x) => x.id === m.j.id)?.demo === true, `demo=${modelosAdm.find((x) => x.id === m.j.id)?.demo}`);

console.log(JSON.stringify({ res, ids: { unidade: u.j.id, area: ar.j.id, atividade: at.j.id, atTmp: atTmp.j.id, veiculo1: v1.j.id, veiculo2: v2.j.id, modelo: m.j.id, inspetor: ui.j.id } }, null, 1));
