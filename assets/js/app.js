/* ==========================================================================
   Just Já — utilitários gerais + storage de processos (Supabase Postgres)
   --------------------------------------------------------------------------
   Persistência:
   - getProcessos()        → async, lê processos do usuário logado
   - getProcesso(id)       → async, lê um processo específico
   - upsertProcesso(proc)  → async, cria ou atualiza
   - newId()               → uuid v4 client-side (pra otimização de UI)

   Conversão de campos:
   - JS:   camelCase  (proc.valorEstimado, proc.numeroCnj, proc.escolhaCessao)
   - SQL:  snake_case (valor_estimado, numero_cnj, escolha_cessao)
   ========================================================================== */

const App = (() => {
  // ---------- Formatação ----------
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
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  }

  // ---------- Máscaras ----------
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

  // ---------- Validação ----------
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

  // ---------- Field helpers ----------
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

  // ---------- Conversão camelCase ↔ snake_case ----------
  // Lista de campos que existem na tabela `processos` (ordem importa só p/ leitura)
  const ROW_TO_PROC = {
    id: "id",
    user_id: "userId",
    titulo: "titulo",
    tipo: "tipo",
    tribunal: "tribunal",
    numero_cnj: "numeroCnj",
    valor_estimado: "valorEstimado",
    descricao: "descricao",
    cpf_titular: "cpfTitular",
    advogado_texto: "advogadoTexto",
    estagio: "estagio",
    status: "status",
    estimativa: "estimativa",
    analise: "analise",
    oferta: "oferta",
    escolha_cessao: "escolhaCessao",
    autorizou_consulta: "autorizouConsulta",
    autorizado_em: "autorizadoEm",
    analise_status: "analiseStatus",
    assinatura: "assinatura",
    protocolacao: "protocolacao",
    pagamento_status: "pagamentoStatus",
    pagamento: "pagamento",
    historico: "historico",
    created_at: "createdAt",
    updated_at: "updatedAt",
  };
  const PROC_TO_ROW = Object.fromEntries(
    Object.entries(ROW_TO_PROC).map(([k, v]) => [v, k])
  );

  function rowToProc(row) {
    if (!row) return null;
    const proc = {};
    for (const [col, key] of Object.entries(ROW_TO_PROC)) {
      if (row[col] !== undefined) proc[key] = row[col];
    }
    return proc;
  }

  function procToRow(proc, userId) {
    const row = {};
    for (const [key, val] of Object.entries(proc)) {
      const col = PROC_TO_ROW[key];
      if (col && col !== "createdAt" && col !== "updatedAt") {
        row[col] = val;
      }
    }
    if (userId) row.user_id = userId;
    return row;
  }

  // ---------- Storage (Supabase) ----------
  function db() { return Auth.client(); }

  async function getProcessos() {
    const user = Auth.currentUser();
    if (!user) return [];
    const { data, error } = await db()
      .from("processos")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) { console.error("getProcessos", error); return []; }
    return data.map(rowToProc);
  }

  async function getProcesso(id) {
    if (!id) return null;
    const { data, error } = await db()
      .from("processos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("getProcesso", error); return null; }
    return rowToProc(data);
  }

  async function upsertProcesso(proc) {
    const user = Auth.currentUser();
    if (!user) throw new Error("Usuário não autenticado.");
    const row = procToRow(proc, user.id);
    const { data, error } = await db()
      .from("processos")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) { console.error("upsertProcesso", error, row); throw error; }
    return rowToProc(data);
  }

  async function deleteProcesso(id) {
    const { error } = await db().from("processos").delete().eq("id", id);
    if (error) throw error;
  }

  function newId() {
    // UUID v4 — Postgres aceita uuid em texto também
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    // fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ---------- Navbar mobile toggle ----------
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
    maskCPF, maskPhone, maskCNJ, maskMoney,
    isValidCPF, isValidEmail,
    bindMask, setFieldError,
    getProcessos, getProcesso, upsertProcesso, deleteProcesso, newId,
  };
})();

window.App = App;
