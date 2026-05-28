/* ==========================================================================
   Just Já — utilitários + camada de acesso ao Supabase
   --------------------------------------------------------------------------
   Módulos expostos no `window`:
     App         — utils (formatação, máscaras, validação, helpers de form)
     Pessoas     — CRUD da tabela `pessoas` (focado no user logado)
     Advogados   — CRUD da tabela `advogados`
     Processos   — CRUD da tabela `processos` (compartilhada entre operações)
     Operacoes   — CRUD da tabela `operacoes` (a antecipação)
     Ofertas     — CRUD da tabela `ofertas` (1:N por operação)
     Assinaturas — CRUD da tabela `assinaturas` (audit log)

   Conversões camelCase ↔ snake_case são feitas automaticamente.
   ========================================================================== */

// ----------------------------------------------------------------------------
// 1. App — utils gerais
// ----------------------------------------------------------------------------
const App = (() => {
  function fmtBRL(v) {
    if (v == null || isNaN(v)) return "R$ 0,00";
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function parseBRL(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function fmtPercent(v, decimals = 2) {
    return (v * 100).toFixed(decimals).replace(".", ",") + "%";
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function maskCPF(v) {
    const s = (v || "").replace(/\D/g, "").slice(0, 11);
    return s
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  }
  function maskPhone(v) {
    const s = (v || "").replace(/\D/g, "").slice(0, 11);
    if (s.length <= 10) {
      return s.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return s.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }
  function maskCNJ(v) {
    const s = (v || "").replace(/\D/g, "").slice(0, 20);
    return s
      .replace(/^(\d{7})(\d)/, "$1-$2")
      .replace(/^(\d{7})-(\d{2})(\d)/, "$1-$2.$3")
      .replace(/^(\d{7})-(\d{2})\.(\d{4})(\d)/, "$1-$2.$3.$4")
      .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)(\d)/, "$1-$2.$3.$4.$5")
      .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})(\d)/, "$1-$2.$3.$4.$5.$6");
  }
  function maskMoney(v) {
    const digits = (v || "").replace(/\D/g, "");
    if (!digits) return "";
    const n = parseInt(digits, 10) / 100;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function maskOAB(v) {
    // só dígitos e letras, até 7 chars
    return (v || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7);
  }

  function isValidCPF(cpf) {
    const s = (cpf || "").replace(/\D/g, "");
    if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
    let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(s[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
    let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === parseInt(s[10]);
  }
  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());
  }
  const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  function isValidUF(uf) { return UFS.includes((uf || "").toUpperCase()); }

  function bindMask(input, maskFn) {
    if (!input) return;
    input.addEventListener("input", () => { input.value = maskFn(input.value); });
  }
  function setFieldError(input, msg) {
    const field = input.closest(".field");
    if (!field) return;
    if (msg) {
      field.classList.add("has-error");
      const err = field.querySelector(".field__error");
      if (err) err.textContent = msg;
    } else {
      field.classList.remove("has-error");
    }
  }

  function newId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function bindNav() {
    const nav = document.querySelector(".nav");
    const toggle = document.querySelector(".nav__toggle");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("is-open"));
    }
  }
  document.addEventListener("DOMContentLoaded", bindNav);

  return {
    fmtBRL, parseBRL, fmtPercent, fmtDate,
    maskCPF, maskPhone, maskCNJ, maskMoney, maskOAB,
    isValidCPF, isValidEmail, isValidUF, UFS,
    bindMask, setFieldError,
    newId,
  };
})();
window.App = App;


// ----------------------------------------------------------------------------
// 2. Conversão camelCase ↔ snake_case (helper interno)
// ----------------------------------------------------------------------------
function _toSnake(s) { return s.replace(/[A-Z]/g, c => "_" + c.toLowerCase()); }
function _toCamel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
// Recursivo: converte chaves snake_case → camelCase, inclusive em objetos
// aninhados (joins do Supabase) e JSONB. Como sempre gravamos JSONB em
// camelCase, a conversão é idempotente nesses casos.
function _rowToObj(row) {
  if (row == null) return row;
  if (Array.isArray(row)) return row.map(_rowToObj);
  if (typeof row === "object" && !(row instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[_toCamel(k)] = (v && typeof v === "object") ? _rowToObj(v) : v;
    }
    return out;
  }
  return row;
}
function _objToRow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[_toSnake(k)] = v;
  }
  return out;
}
function _db() { return Auth.client(); }


// ----------------------------------------------------------------------------
// 3. Pessoas
// ----------------------------------------------------------------------------
const Pessoas = (() => {
  let _cache = null;

  async function getCurrent() {
    if (_cache) return _cache;
    const user = Auth.currentUser();
    if (!user) return null;
    const { data, error } = await _db()
      .from("pessoas").select("*").eq("user_id", user.id).maybeSingle();
    if (error) { console.error("Pessoas.getCurrent", error); return null; }
    _cache = _rowToObj(data);
    return _cache;
  }

  // Pega a pessoa atual; se não existir, cria a partir dos metadados do auth.users.
  // Útil pra casos onde o trigger handle_new_user não rodou (schema antigo,
  // contas pré-existentes, race condition no signup, etc.).
  async function ensureCurrent() {
    let p = await getCurrent();
    if (p) return p;

    const sessionUser = Auth.getSession()?.user;
    if (!sessionUser) return null;
    const m = sessionUser.user_metadata || {};

    const row = {
      user_id: sessionUser.id,
      nome: m.nome || (sessionUser.email || "").split("@")[0],
      email: sessionUser.email,
      cpf_cnpj: m.cpf || null,
      telefone: m.telefone || null,
      role: m.role || "cliente",
      whatsapp_opt_in: !!m.whatsapp_opt_in,
      whatsapp_opt_in_at: m.whatsapp_opt_in ? new Date().toISOString() : null,
    };
    const { data, error } = await _db()
      .from("pessoas").insert(row).select().single();
    if (error) {
      console.error("Pessoas.ensureCurrent insert", error);
      throw new Error("Não consegui criar seu perfil: " + (error.message || error));
    }
    _cache = _rowToObj(data);
    return _cache;
  }

  function invalidate() { _cache = null; }

  async function updateCurrent(patch) {
    const me = await getCurrent();
    if (!me) throw new Error("Pessoa não encontrada.");
    const { data, error } = await _db()
      .from("pessoas").update(_objToRow(patch)).eq("id", me.id).select().single();
    if (error) throw error;
    _cache = _rowToObj(data);
    return _cache;
  }

  async function getById(id) {
    const { data, error } = await _db()
      .from("pessoas").select("*").eq("id", id).maybeSingle();
    if (error) { console.error("Pessoas.getById", error); return null; }
    return _rowToObj(data);
  }

  return { getCurrent, ensureCurrent, updateCurrent, getById, invalidate };
})();
window.Pessoas = Pessoas;


// ----------------------------------------------------------------------------
// 4. Advogados
// ----------------------------------------------------------------------------
const Advogados = (() => {
  async function getCurrent() {
    const me = await Pessoas.getCurrent();
    if (!me) return null;
    const { data, error } = await _db()
      .from("advogados").select("*").eq("pessoa_id", me.id).maybeSingle();
    if (error) { console.error("Advogados.getCurrent", error); return null; }
    return _rowToObj(data);
  }

  async function upsertForCurrent({ oabNumero, oabEstado, banca }) {
    const me = await Pessoas.getCurrent();
    if (!me) throw new Error("Pessoa não encontrada.");
    const row = {
      pessoa_id: me.id,
      oab_numero: oabNumero,
      oab_estado: (oabEstado || "").toUpperCase(),
      banca: banca || null,
    };
    const { data, error } = await _db()
      .from("advogados").upsert(row, { onConflict: "pessoa_id" }).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  return { getCurrent, upsertForCurrent };
})();
window.Advogados = Advogados;


// ----------------------------------------------------------------------------
// 5. Processos
// ----------------------------------------------------------------------------
const Processos = (() => {
  async function create({ numeroCnj, tipo, tribunal, valorCausa, dadosPublicos }) {
    const row = _objToRow({ numeroCnj, tipo, tribunal, valorCausa, dadosPublicos });
    const { data, error } = await _db()
      .from("processos").insert(row).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function update(id, patch) {
    const { data, error } = await _db()
      .from("processos").update(_objToRow(patch)).eq("id", id).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function getByCnj(cnj) {
    if (!cnj) return null;
    const { data, error } = await _db()
      .from("processos").select("*").eq("numero_cnj", cnj).maybeSingle();
    if (error) { console.error("Processos.getByCnj", error); return null; }
    return _rowToObj(data);
  }

  async function get(id) {
    const { data, error } = await _db()
      .from("processos").select("*").eq("id", id).maybeSingle();
    if (error) { console.error("Processos.get", error); return null; }
    return _rowToObj(data);
  }

  return { create, update, get, getByCnj };
})();
window.Processos = Processos;


// ----------------------------------------------------------------------------
// 6. Operacoes  (a antecipação — substitui a antiga `processos` do MVP)
// ----------------------------------------------------------------------------
const Operacoes = (() => {
  async function list() {
    const me = await Pessoas.getCurrent();
    if (!me) return [];
    // Retorna todas as operações onde a pessoa é solicitante, cliente ou advogado.
    const { data, error } = await _db()
      .from("operacoes")
      .select("*, processos(*)")
      .or(`solicitante_id.eq.${me.id},cliente_id.eq.${me.id},advogado_id.eq.${me.id}`)
      .order("updated_at", { ascending: false });
    if (error) { console.error("Operacoes.list", error); return []; }
    return data.map(_rowToObj);
  }

  async function get(id) {
    const { data, error } = await _db()
      .from("operacoes")
      .select("*, processos(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("Operacoes.get", error); return null; }
    return _rowToObj(data);
  }

  async function create({ processoId, tipoSolicitante, escopo, apelido, descricao, clienteId, advogadoId, advogadoTexto, estagio }) {
    const me = await Pessoas.getCurrent();
    if (!me) throw new Error("Pessoa não encontrada.");
    const row = _objToRow({
      processoId,
      solicitanteId: me.id,
      tipoSolicitante,
      escopo: escopo || "integral",
      estagio: estagio || "cadastro",
      apelido,
      descricao,
      clienteId,
      advogadoId,
      advogadoTexto,
      historico: [{ estagio: estagio || "cadastro", at: new Date().toISOString() }],
    });
    const { data, error } = await _db()
      .from("operacoes").insert(row).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function update(id, patch) {
    const { data, error } = await _db()
      .from("operacoes").update(_objToRow(patch)).eq("id", id).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function advance(id, novoEstagio, extras = {}) {
    const op = await get(id);
    if (!op) throw new Error("Operação não encontrada.");
    const historico = Array.isArray(op.historico) ? op.historico : [];
    historico.push({ estagio: novoEstagio, at: new Date().toISOString() });
    return await update(id, { estagio: novoEstagio, historico, ...extras });
  }

  return { list, get, create, update, advance };
})();
window.Operacoes = Operacoes;


// ----------------------------------------------------------------------------
// 7. Ofertas
// ----------------------------------------------------------------------------
const Ofertas = (() => {
  async function listByOperacao(operacaoId) {
    const { data, error } = await _db()
      .from("ofertas").select("*")
      .eq("operacao_id", operacaoId)
      .order("created_at", { ascending: false });
    if (error) { console.error("Ofertas.list", error); return []; }
    return data.map(_rowToObj);
  }

  async function getCurrent(operacaoId) {
    // oferta mais recente ativa
    const { data, error } = await _db()
      .from("ofertas").select("*")
      .eq("operacao_id", operacaoId)
      .in("status", ["ativa", "aceita"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.error("Ofertas.getCurrent", error); return null; }
    return _rowToObj(data);
  }

  async function create({ operacaoId, valorBaseCausa, valorAntecipado, descontoPct, validadeDias, escolhaCessao, memorial }) {
    // marca outras como superadas
    await _db()
      .from("ofertas")
      .update({ status: "superada", superada_em: new Date().toISOString() })
      .eq("operacao_id", operacaoId)
      .eq("status", "ativa");

    const validade = validadeDias || 7;
    const expiresAt = new Date(Date.now() + validade * 24 * 60 * 60 * 1000).toISOString();
    const row = _objToRow({
      operacaoId,
      valorBaseCausa,
      valorAntecipado,
      descontoPct,
      validadeDias: validade,
      expiresAt,
      escolhaCessao,
      memorial,
    });
    const { data, error } = await _db()
      .from("ofertas").insert(row).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function aceitar(id, escolhaCessao) {
    const { data, error } = await _db()
      .from("ofertas")
      .update({
        status: "aceita",
        aceita_em: new Date().toISOString(),
        escolha_cessao: escolhaCessao,
      })
      .eq("id", id).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  return { listByOperacao, getCurrent, create, aceitar };
})();
window.Ofertas = Ofertas;


// ----------------------------------------------------------------------------
// 8. Assinaturas
// ----------------------------------------------------------------------------
const Assinaturas = (() => {
  async function create({ operacaoId, ofertaId, role, nomeDigitado, ip, hash }) {
    const me = await Pessoas.getCurrent();
    const row = _objToRow({
      operacaoId,
      ofertaId,
      signatarioId: me?.id,
      role,
      nomeDigitado,
      ip,
      hash,
    });
    const { data, error } = await _db()
      .from("assinaturas").insert(row).select().single();
    if (error) throw error;
    return _rowToObj(data);
  }

  async function listByOperacao(operacaoId) {
    const { data, error } = await _db()
      .from("assinaturas").select("*")
      .eq("operacao_id", operacaoId)
      .order("assinado_em", { ascending: true });
    if (error) { console.error("Assinaturas.list", error); return []; }
    return data.map(_rowToObj);
  }

  return { create, listByOperacao };
})();
window.Assinaturas = Assinaturas;


// ----------------------------------------------------------------------------
// 9. Admin / Backoffice (depende das policies de staff — supabase-admin.sql)
// ----------------------------------------------------------------------------
const Admin = (() => {
  const HONORARIOS_PCT_PADRAO = 0.30;

  async function role() {
    const p = await Pessoas.getCurrent();
    return p?.role || null;
  }
  async function isStaff() {
    const r = await role();
    return r === "admin" || r === "operador";
  }
  async function isAdmin() {
    return (await role()) === "admin";
  }

  // Lista TODAS as operações (RLS de staff permite). Inclui joins úteis.
  async function listOperacoes() {
    const { data, error } = await _db()
      .from("operacoes")
      .select("*, processos(*), solicitante:pessoas!solicitante_id(*)")
      .order("updated_at", { ascending: false });
    if (error) { console.error("Admin.listOperacoes", error); throw error; }
    return data.map(_rowToObj);
  }

  async function getOperacao(id) {
    const { data, error } = await _db()
      .from("operacoes")
      .select("*, processos(*), solicitante:pessoas!solicitante_id(*), cliente:pessoas!cliente_id(*), advogado:pessoas!advogado_id(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("Admin.getOperacao", error); throw error; }
    return _rowToObj(data);
  }

  async function getOfertas(operacaoId) {
    return await Ofertas.listByOperacao(operacaoId);
  }
  async function getAssinaturas(operacaoId) {
    return await Assinaturas.listByOperacao(operacaoId);
  }

  async function updateOperacao(id, patch) {
    return await Operacoes.update(id, patch);
  }

  async function setEstagio(id, estagio) {
    return await Operacoes.advance(id, estagio);
  }

  async function addNota(id, texto) {
    const op = await getOperacao(id);
    const notas = Array.isArray(op.notasInternas) ? op.notasInternas : [];
    const me = await Pessoas.getCurrent();
    notas.push({ texto, autor: me?.nome || "equipe", at: new Date().toISOString() });
    return await Operacoes.update(id, { notasInternas: notas });
  }

  // Recalcula análise (mock) e gera NOVA oferta (versionada).
  async function rerunAnalise(id, overrides = {}) {
    const op = await getOperacao(id);
    const valorDeclarado = op.valorEstimado || 10000;

    // valor base: usa override OU recalcula com pequena variação aleatória
    const valorBaseCausa = overrides.valorBaseCausa != null
      ? overrides.valorBaseCausa
      : Math.round(valorDeclarado * (1 + ((Math.random() * 0.3) - 0.15)));

    const classe = overrides.classe || (() => {
      const k = Math.floor(Math.random() * 100);
      return k < 25 ? "B" : k < 60 ? "C" : k < 85 ? "D" : "E";
    })();
    const desconto = overrides.descontoPct != null
      ? overrides.descontoPct
      : { A: 0.10, B: 0.18, C: 0.28, D: 0.40, E: 0.55 }[classe];
    const valorAntecipado = overrides.valorAntecipado != null
      ? overrides.valorAntecipado
      : Math.round(valorBaseCausa * (1 - desconto));

    const analise = {
      valorBaseCausa,
      fase: overrides.fase || op.analise?.fase || "Em fase de cumprimento de sentença",
      decisao: overrides.decisao || op.analise?.decisao || "Sentença favorável transitada em julgado",
      classe,
      confianca: overrides.confianca ?? 0.82,
      recalculadoEm: new Date().toISOString(),
    };
    await Operacoes.update(id, { analise, analiseStatus: "concluida" });
    const novaOferta = await Ofertas.create({
      operacaoId: id,
      valorBaseCausa,
      valorAntecipado,
      descontoPct: desconto,
      validadeDias: overrides.validadeDias || 7,
      memorial: { classe, desconto, valorDeclarado, valorBaseCausa, origem: "backoffice" },
    });
    return { analise, oferta: novaOferta };
  }

  async function aprovarComprovante(id) {
    const op = await getOperacao(id);
    const protocolacao = { ...(op.protocolacao || {}), validado: true, validadoEm: new Date().toISOString() };
    return await Operacoes.update(id, { protocolacao });
  }
  async function rejeitarComprovante(id, motivo) {
    const op = await getOperacao(id);
    const protocolacao = { ...(op.protocolacao || {}), validado: false, rejeitadoEm: new Date().toISOString(), motivoRejeicao: motivo || null, comprovanteEnviado: false };
    return await Operacoes.update(id, { protocolacao, pagamentoStatus: "pendente" });
  }

  async function liberarPagamento(id, { valor, txid }) {
    const pagamento = { pagoEm: new Date().toISOString(), valor: valor || null, txid: txid || null, liberadoPor: (await Pessoas.getCurrent())?.nome };
    return await Operacoes.update(id, { pagamentoStatus: "pago", pagamento, status: "concluida" });
  }

  return {
    role, isStaff, isAdmin,
    listOperacoes, getOperacao, getOfertas, getAssinaturas,
    updateOperacao, setEstagio, addNota,
    rerunAnalise, aprovarComprovante, rejeitarComprovante, liberarPagamento,
    HONORARIOS_PCT_PADRAO,
  };
})();
window.Admin = Admin;
