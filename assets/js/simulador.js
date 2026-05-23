/* ==========================================================================
   Just Já — Simulador rough de antecipação
   --------------------------------------------------------------------------
   Heurística simples (placeholder do "motor de pricing externo").
   Usada na landing e como referência inicial dentro da jornada.
   Foco: pequenas causas CÍVEIS (aéreo, consumidor, bancário, outras
   relações de consumo).
   ========================================================================== */

const Simulador = (() => {
  const TIPOS = {
    aereo:       { label: "Direito Aéreo",              taxaMensal: 0.030, prazoMeses: 18 },
    consumidor:  { label: "Consumidor",                 taxaMensal: 0.032, prazoMeses: 20 },
    bancario:    { label: "Bancário",                   taxaMensal: 0.033, prazoMeses: 22 },
    outras:      { label: "Outras relações de consumo", taxaMensal: 0.032, prazoMeses: 20 },
  };

  function estimar({ valor, tipo }) {
    const t = TIPOS[tipo] || TIPOS.consumidor;
    const v = Number(valor) || 0;
    if (v <= 0) return null;

    const fator = Math.pow(1 + t.taxaMensal, t.prazoMeses);
    const valorPresenteCheio = v / fator;
    // intervalo: -10% / +5% em torno do valor presente para sinalizar incerteza
    const minimo  = valorPresenteCheio * 0.90;
    const maximo  = valorPresenteCheio * 1.05;
    const central = valorPresenteCheio * 0.97;
    return {
      tipo: t.label,
      prazoMeses: t.prazoMeses,
      taxaMensal: t.taxaMensal,
      central, minimo, maximo,
      valorOriginal: v,
    };
  }

  function bindForm(formId, resultId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const valor = form.querySelector("[data-sim-valor]");
    const tipo  = form.querySelector("[data-sim-tipo]");
    const result = document.getElementById(resultId);
    if (valor) App.bindMask(valor, App.maskMoney);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = App.parseBRL(valor.value);
      const est = estimar({ valor: v, tipo: tipo.value });
      if (!est) {
        result.classList.remove("show");
        return;
      }
      result.innerHTML = `
        <div class="muted" style="font-size:.85rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">
          Estimativa preliminar
        </div>
        <div class="sim__amount mt-1">${App.fmtBRL(est.central)}</div>
        <div class="sim__range">
          Faixa estimada: ${App.fmtBRL(est.minimo)} a ${App.fmtBRL(est.maximo)}
        </div>
        <p class="muted mt-2" style="font-size:.88rem;">
          Esta é uma estimativa preliminar com base no valor declarado e no tipo do processo.
          A oferta final depende da análise do processo atualizado.
        </p>
        <div class="mt-2">
          <a href="cadastro.html" class="btn btn--primary">Quero fazer um cadastro</a>
        </div>
      `;
      result.classList.add("show");
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return { estimar, bindForm, TIPOS };
})();

window.Simulador = Simulador;
