/* ==========================================================================
   Just Já — utilitários gerais
   ========================================================================== */

const App = (() => {
  // ---------- Formatação ----------
  function fmtBRL(v) {
    if (v == null || isNaN(v)) return "R$ 0,00";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
    // 0000000-00.0000.0.00.0000
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

  // ---------- Storage de processos ----------
  function processStorageKey(userEmail) {
    return `justja.processos.${userEmail || "anon"}.v1`;
  }
  function getProcessos(userEmail) {
    try {
      return JSON.parse(localStorage.getItem(processStorageKey(userEmail)) || "[]");
    } catch { return []; }
  }
  function saveProcessos(userEmail, list) {
    localStorage.setItem(processStorageKey(userEmail), JSON.stringify(list));
  }
  function upsertProcesso(userEmail, processo) {
    const list = getProcessos(userEmail);
    const i = list.findIndex(p => p.id === processo.id);
    if (i >= 0) list[i] = { ...list[i], ...processo, updatedAt: new Date().toISOString() };
    else list.push({ ...processo, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    saveProcessos(userEmail, list);
    return processo;
  }
  function getProcesso(userEmail, id) {
    return getProcessos(userEmail).find(p => p.id === id) || null;
  }
  function newId() { return "proc-" + Math.random().toString(36).slice(2, 10); }

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
    getProcessos, saveProcessos, upsertProcesso, getProcesso, newId,
  };
})();

window.App = App;
