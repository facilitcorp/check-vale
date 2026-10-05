// Parte 3 (servidor): versionamento V1→V2→V3, retrato do veículo e recusa real. Rodar depois de qa/aceite-admin.mjs, com a API no ar.
const B = process.env.API ?? "http://localhost:3100/api";
const res = []; const ok = (p, c, ev = "") => res.push({ p, r: c ? "PASSOU" : "FALHOU", ev });
const call = async (tok, met, cam, corpo) => { const r = await fetch(B + cam, { method: met, headers: { authorization: `Bearer ${tok}`, ...(corpo ? { "content-type": "application/json" } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, senha) => (await (await fetch(B + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, senha }) })).json());
const la = await login("admin@checkvale.dev", "checkvale"), li = await login("inspetor.aceite@checkvale.dev", "aceite-2026");
const A = la.token, I = li.token;
const agora = () => new Date().toISOString(), uid = () => crypto.randomUUID(), disp = uid();
const sync = async (ops) => (await call(I, "POST", "/sync", { dispositivoId: disp, operacoes: ops.map((o) => ({ opId: uid(), criadaEm: agora(), ...o })) })).j.resultados;
const cat = (await call(I, "GET", "/catalogo")).j;
const m1 = cat.modelos.find((x) => x.nome === "Checklist DEMO Aceite");
const v = ((await call(I, "GET", "/veiculos")).j.veiculos ?? (await call(I, "GET", "/veiculos")).j).find((x) => x.placa === "DEM1A01");
const area = cat.areas.find((a) => a.nome.startsWith("Área DEMO Mina")), atv = cat.atividades.find((a) => a.nome === "Atividade DEMO Transporte");
const it1 = Object.fromEntries(m1.categorias.flatMap((c) => c.itens.map((i) => [i.codigo, i.id])));
const resp = (cod, status, extra = {}) => ({ itemId: it1[cod], status, observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: agora(), ...extra });
const inspecao = (id, m, respostas, status = "em_andamento", veic = v) => ({ id, modeloId: m.id, modeloVersao: m.versao, unidadeId: veic.unidadeId, areaId: area.id, atividadeId: atv.id, veiculoId: veic.id, inspetorId: li.usuario.id, tipoVeiculoId: veic.tipoVeiculoId, atributosVeiculo: veic.atributos, status, iniciadaEm: agora(), concluidaEm: status === "concluida" ? agora() : null, respostas });

// 1. Versionamento: inspeção V1 aberta
const velha = uid();
const r0 = await sync([{ tipo: "inspecao.salvar", inspecao: inspecao(velha, m1, [resp("cinto", "conforme"), resp("engate_reboque", "conforme")]) }]);
ok("1 inspeção V1 aberta no servidor", r0[0].status === "aplicada", r0[0].status);
const nr = await call(A, "POST", `/admin/modelos/${m1.id}/rascunho`);
const v2 = nr.j; v2.categorias[1].itens.find((i) => i.codigo === "pneus").titulo = "Pneus e estepe";
v2.categorias[0].itens.push({ id: uid(), codigo: "extintor", titulo: "Extintor", descricao: "", ordem: 2, permiteNaoAplica: false, criticidadeSugerida: "alta", aplicavel: { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] } });
await call(A, "PUT", `/admin/modelos/${m1.id}/versoes/${v2.versao}`, { nome: v2.nome, aplicavel: v2.aplicavel, categorias: v2.categorias });
const pub = await call(A, "POST", `/admin/modelos/${m1.id}/versoes/${v2.versao}/publicar`);
ok("1 V2 publicada (item alterado + item novo)", pub.s === 200 && pub.j.versao === 2, `${pub.s} v${pub.j?.versao}`);
const v1Agora = (await call(A, "GET", `/admin/modelos/${m1.id}/versoes/1`)).j;
ok("1 V1 arquivada e intacta", v1Agora.status === "arquivada" && v1Agora.categorias[1].itens.some((i) => i.titulo === "Pneus") && !v1Agora.categorias[0].itens.some((i) => i.codigo === "extintor"), v1Agora.status);
const r1 = await sync([{ tipo: "inspecao.salvar", inspecao: inspecao(velha, m1, [resp("cinto", "conforme"), resp("engate_reboque", "conforme"), resp("pneus", "conforme", { observacao: "ok" })]) }]);
ok("1 inspeção antiga continua aceitando respostas em V1", r1[0].status === "aplicada", r1[0].status + " " + (r1[0].erro ?? ""));
const cat2 = (await call(I, "GET", "/catalogo")).j.modelos.find((x) => x.id === m1.id);
ok("1 catálogo do inspetor entrega V2 para inspeção nova", cat2.versao === 2 && cat2.categorias[0].itens.some((i) => i.codigo === "extintor"), `v${cat2.versao}`);
const nova = uid();
const r2 = await sync([{ tipo: "inspecao.salvar", inspecao: inspecao(nova, cat2, [{ ...resp("cinto", "conforme"), itemId: cat2.categorias[0].itens.find((i) => i.codigo === "extintor").id }]) }]);
ok("1 inspeção nova em V2 aceita", r2[0].status === "aplicada", r2[0].status);
const rx = await sync([{ tipo: "inspecao.salvar", inspecao: inspecao(uid(), m1, [{ ...resp("cinto", "conforme"), itemId: cat2.categorias[0].itens.find((i) => i.codigo === "extintor").id }]) }]);
ok("1 item da V2 em inspeção V1 é recusado", rx[0].status === "rejeitada", `${rx[0].status}: ${rx[0].erro}`);

// 2. Snapshot: muda veículo/atributos e template (V3) depois
const insps0 = (await call(I, "GET", "/inspecoes")).j.inspecoes;
const antes = insps0.find((x) => x.id === velha);
await call(A, "PATCH", `/admin/veiculos/${v.id}`, { modelo: "FH 460", atributos: { cor_cabine: "azul", eixos: 2, possui_reboque: false, freio_demo: "hidraulico" } });
const nr3 = (await call(A, "POST", `/admin/modelos/${m1.id}/rascunho`)).j; nr3.categorias[0].itens = nr3.categorias[0].itens.filter((i) => i.codigo !== "cinto");
await call(A, "PUT", `/admin/modelos/${m1.id}/versoes/${nr3.versao}`, { nome: nr3.nome, aplicavel: nr3.aplicavel, categorias: nr3.categorias });
const pub3 = await call(A, "POST", `/admin/modelos/${m1.id}/versoes/${nr3.versao}/publicar`);
const depois = (await call(I, "GET", "/inspecoes")).j.inspecoes.find((x) => x.id === velha);
ok("2 V3 publicada (remove item)", pub3.s === 200, `v${pub3.j?.versao}`);
ok("2 inspeção antiga: retrato do veículo intacto", JSON.stringify(antes.atributosVeiculo) === JSON.stringify(depois.atributosVeiculo) && depois.atributosVeiculo.possui_reboque === true, JSON.stringify(depois.atributosVeiculo));
ok("2 inspeção antiga: versão e respostas intactas", depois.modeloVersao === 1 && depois.respostas.length === 3 && JSON.stringify(antes.respostas) === JSON.stringify(depois.respostas), `v${depois.modeloVersao}, ${depois.respostas.length} respostas`);
const r3 = await sync([{ tipo: "inspecao.salvar", inspecao: { ...inspecao(velha, m1, [resp("cinto", "conforme"), resp("engate_reboque", "conforme"), resp("pneus", "conforme", { observacao: "ok" }), resp("ar_cond", "nao_aplica"), resp("freio_ar", "conforme")], "concluida"), atributosVeiculo: antes.atributosVeiculo } }]);
const fim = (await call(I, "GET", "/inspecoes")).j.inspecoes.find((x) => x.id === velha);
ok("2 inspeção antiga conclui em V1 depois de V2 e V3 (engate e freio a ar seguem valendo)", r3[0].status === "aplicada" && fim.status === "concluida" && fim.respostas.length === 5, `${r3[0].status}, ${fim.respostas.length} respostas`);
const pdf = await fetch(`${B}/inspecoes/${velha}/relatorio.pdf`, { headers: { authorization: `Bearer ${I}` } });
ok("2 PDF da inspeção antiga", pdf.status === 200 && (await pdf.arrayBuffer()).byteLength > 1000, `${pdf.status}`);

// 4. Recusa real do servidor: placa duplicada
const sem = (await call(I, "GET", "/veiculos")).j; const lista = sem.veiculos ?? sem;
const dup = { ...lista.find((x) => x.placa === "DEM1A02"), id: uid(), criadoEm: agora(), atualizadoEm: agora() }; delete dup.demo; dup.demo = false;
const rr = await sync([{ tipo: "veiculo.salvar", veiculo: dup }]);
ok("4 placa duplicada é recusada com motivo", rr[0].status === "rejeitada" && /DEM1A02/.test(rr[0].erro ?? ""), `${rr[0].status}: ${rr[0].erro}`);
console.log(JSON.stringify({ res, velha, nova }, null, 1));
