/* ==========================================================================
   Just Já — Jornada de antecipação
   --------------------------------------------------------------------------
   Cobre as duas variações de jornada:
     - CLIENTE (autor do processo): antecipa o valor da causa.
     - ADVOGADO: antecipa seus honorários (escopo='so_honorarios').
                 (Modo "integral conjunto com o cliente" virá depois.)

   Estágios:
     1. cadastro         — dados básicos do processo
     2. consultaAnalise  — autorização + CNJ + análise
     3. oferta           — proposta + escolha (quando cliente)
     4. assinatura       — contrato + termo
     5. protocolacao     — upload de termo assinado + comprovante
     6. pagamento        — status PIX

   Persistência:
     - Estado da operação → Operacoes.update / advance
     - Dados do processo (CNJ, tipo, tribunal) → Processos.update
     - Ofertas geradas pela análise → Ofertas.create
     - Aceite → Ofertas.aceitar
     - Assinatura → Assinaturas.create
   ========================================================================== */

const Jornada = (() => {
  const ESTAGIOS = [
    { id: "cadastro",        label: "Cadastro" },
    { id: "consultaAnalise", label: "Análise" },
    { id: "oferta",          label: "Oferta" },
    { id: "assinatura",      label: "Assinatura" },
    { id: "protocolacao",    label: "Protocolação" },
    { id: "pagamento",       label: "Pagamento" },
  ];

  const TRIBUNAIS = [
    "JEC SP — Foro Central (1º andar)",
    "JEC SP — Foro Regional Santo Amaro",
    "JEC SP — Foro Regional Itaquera",
    "JEC SP — Foro Regional Penha",
    "JEC RJ — 1ª Região (Centro)",
    "JEC RJ — 2ª Região (Tijuca)",
    "JEC MG — Belo Horizonte (Sede)",
    "JEC DF — Brasília (Anexo III)",
    "JEC RS — Porto Alegre (Foro Central)",
    "JEC PR — Curitiba (Foro Central)",
    "JEC BA — Salvador (Sede)",
    "JEC CE — Fortaleza (Sede)",
  ];

  const HONORARIOS_PCT_PADRAO = 0.30;

  // ---------- Helpers ----------
  function idxOf(stage) {
    return ESTAGIOS.findIndex(e => e.id === stage);
  }

  function renderStepper(target, currentStage) {
    const cur = idxOf(currentStage);
    target.innerHTML = ESTAGIOS.map((e, i) => {
      const cls = i < cur ? "done" : i === cur ? "current" : "";
      return `<div class="stepper__item ${cls}">
        <div class="stepper__num">${i < cur ? "✓" : i + 1}</div>
        <div>${e.label}</div>
      </div>`;
    }).join("");
  }

  function getQueryOpId() {
    return new URL(window.location.href).searchParams.get("id");
  }

  async function loadOperacao() {
    const id = getQueryOpId();
    if (!id) return null;
    return await Operacoes.get(id);
  }

  function getStageFromQueryOrOp(op) {
    // A fonte da verdade é SEMPRE o estágio atual da operação no banco.
    // Ignoramos o ?stage= da URL de propósito: se o backoffice mover a etapa
    // (pra frente ou pra trás), o cliente vê o estado correto ao recarregar,
    // sem ficar preso numa etapa defasada da URL.
    return op?.estagio || "cadastro";
  }

  async function advance(op, novoEstagio, extras = {}) {
    await Operacoes.advance(op.id, novoEstagio, extras);
    window.location.href = `jornada.html?id=${op.id}&stage=${novoEstagio}`;
  }

  // Hash determinístico do id pra decidir sync vs async (40% async)
  function isAsyncAnalise(op) {
    const seed = (op.id || "").replace(/\D/g, "").slice(-2);
    const n = parseInt(seed || "50", 10);
    return n < 40;
  }

  function isAdvogado(op)        { return op.tipoSolicitante === "advogado"; }
  function isSoHonorarios(op)    { return op.escopo === "so_honorarios"; }

  // ---------- Render principal ----------
  async function render(op) {
    const stage = getStageFromQueryOrOp(op);
    const target  = document.getElementById("journey-content");
    const stepper = document.getElementById("journey-stepper");
    renderStepper(stepper, stage);

    const renderer = RENDERERS[stage] || RENDERERS.cadastro;
    await renderer(target, op);
  }

  // ===========================================================================
  // RENDERERS
  // ===========================================================================
  const RENDERERS = {

    // ---------- 1. CADASTRO ----------
    async cadastro(target, op) {
      const tribunaisOpts = TRIBUNAIS.map(t => {
        const sel = op.processos?.tribunal === t ? "selected" : "";
        return `<option value="${t}" ${sel}>${t}</option>`;
      }).join("");
      const tribAtual = op.processos?.tribunal || "";
      const outrosSel = tribAtual && !TRIBUNAIS.includes(tribAtual) ? "selected" : "";

      const adv = isAdvogado(op);
      const labelValor = adv
        ? "Valor estimado dos seus honorários"
        : "Valor estimado a receber";
      const hintValor = adv
        ? "Quanto você espera receber de honorários nesse processo."
        : "Use o valor total que está na ação ou que seu advogado estimou.";

      target.innerHTML = `
        <h2>${adv ? "Vamos cadastrar a antecipação dos seus honorários" : "Vamos cadastrar o seu processo"}</h2>
        <p class="muted">
          Preencha as informações abaixo. Não precisa ser exato agora — você pode ajustar depois.
        </p>

        <form id="form-cadastro" class="form mt-3">
          <div class="field">
            <label class="field__label" for="c-apelido">Apelido (como identificar esta antecipação)</label>
            <input id="c-apelido" placeholder="${adv ? "Ex.: Honorários Latam – out/24" : "Ex.: Voo cancelado Latam – out/24"}" value="${op.apelido || ""}" required>
            <span class="field__hint">É só para você se localizar no painel.</span>
          </div>

          <div class="field--row">
            <div class="field">
              <label class="field__label" for="c-tipo">Tipo do processo</label>
              <select id="c-tipo" required>
                <option value="aereo"      ${op.processos?.tipo==="aereo"?"selected":""}>Direito Aéreo</option>
                <option value="consumidor" ${op.processos?.tipo==="consumidor"?"selected":""}>Consumidor</option>
                <option value="bancario"   ${op.processos?.tipo==="bancario"?"selected":""}>Bancário</option>
                <option value="outras"     ${op.processos?.tipo==="outras"?"selected":""}>Outras relações de consumo</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="c-valor">${labelValor}</label>
              <input id="c-valor" inputmode="numeric" placeholder="R$ 0,00" value="${op.valorEstimado ? App.fmtBRL(op.valorEstimado) : ""}" required>
              <span class="field__hint">${hintValor}</span>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="c-tribunal">Tribunal / Vara</label>
            <select id="c-tribunal" required>
              <option value="">Selecione...</option>
              ${tribunaisOpts}
              <option value="__outros__" ${outrosSel?"selected":""}>Outros (digitar manualmente)</option>
            </select>
            <input id="c-tribunal-outros" class="mt-1 ${outrosSel?"":"hide"}" placeholder="Digite o tribunal/vara" value="${outrosSel?tribAtual:""}">
          </div>

          <div class="field">
            <label class="field__label" for="c-descricao">Conte rapidamente o que aconteceu (opcional)</label>
            <textarea id="c-descricao" rows="3" placeholder="${adv ? "Ex.: Atuei como advogado do autor em ação de indenização contra Latam por voo cancelado..." : "Ex.: Voo Latam cancelado sem aviso, comprei outra passagem do meu bolso..."}">${op.descricao || ""}</textarea>
            <span class="field__hint">Vai nos ajudar na análise. Pode pular se preferir.</span>
          </div>

          <div class="journey-actions">
            <button type="submit" class="btn btn--primary btn--lg">Salvar e continuar →</button>
            <a href="dashboard.html" class="btn btn--ghost">Voltar ao painel</a>
          </div>
        </form>
      `;

      const valorEl = document.getElementById("c-valor");
      App.bindMask(valorEl, App.maskMoney);

      const tribSel = document.getElementById("c-tribunal");
      const tribOutros = document.getElementById("c-tribunal-outros");
      tribSel.addEventListener("change", () => {
        if (tribSel.value === "__outros__") {
          tribOutros.classList.remove("hide");
          tribOutros.required = true;
        } else {
          tribOutros.classList.add("hide");
          tribOutros.required = false;
        }
      });

      document.getElementById("form-cadastro").onsubmit = async (e) => {
        e.preventDefault();
        const apelido = document.getElementById("c-apelido").value.trim();
        const tipo    = document.getElementById("c-tipo").value;
        const valor   = App.parseBRL(valorEl.value);
        const tribunal = tribSel.value === "__outros__"
          ? tribOutros.value.trim()
          : tribSel.value;
        const descricao = document.getElementById("c-descricao").value.trim();

        // Atualiza/Cria processo
        if (op.processoId) {
          await Processos.update(op.processoId, { tipo, tribunal });
        } else {
          const novoProc = await Processos.create({ tipo, tribunal });
          op.processoId = novoProc.id;
        }
        // Atualiza operação
        await Operacoes.update(op.id, {
          processoId: op.processoId,
          apelido, descricao, valorEstimado: valor,
        });
        await advance(op, "consultaAnalise");
      };
    },

    // ---------- 2. CONSULTA + ANÁLISE ----------
    async consultaAnalise(target, op) {
      const sub = op.analiseStatus || "form";
      // No piloto NÃO geramos oferta automática. O cliente informa o processo
      // e autoriza; a partir daí a operação fica "aguardando a equipe" — que
      // roda a análise e gera a proposta pelo backoffice.
      // Qualquer status diferente de "form" = já enviado → tela de espera
      // (evita mostrar o formulário de novo depois do envio).
      if (sub !== "form") return renderAguardandoEquipe(target, op);
      return renderConsultaForm(target, op);
    },

    // ---------- 3. OFERTA ----------
    async oferta(target, op) {
      const oferta = await Ofertas.getCurrent(op.id);
      const a = op.analise;
      if (!oferta || !a) {
        target.innerHTML = `<p>Oferta indisponível. <a href="?id=${op.id}&stage=consultaAnalise">Voltar à análise</a></p>`;
        return;
      }
      const adv = isAdvogado(op);
      const soHonorarios = isSoHonorarios(op);

      // Se o cliente já aceitou, mostra confirmação + espera (backoffice libera assinatura).
      if (oferta.status === "aceita") {
        target.innerHTML = `
          <h2>✅ Proposta aceita!</h2>
          <p class="muted">
            Que ótimo! Recebemos o seu aceite. Agora estamos preparando os documentos da cessão.
            Você será avisado(a) por e-mail assim que o contrato estiver pronto para assinatura.
          </p>
          <div class="card mt-3" style="background: linear-gradient(135deg, var(--success-100), #fff); border-color: #86efac;">
            <div class="muted" style="font-size:.85rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Valor aceito</div>
            <div class="sim__amount" style="font-size: 2.2rem;">${App.fmtBRL(oferta.escolhaCessao === "parcial" ? Math.round((oferta.valorBaseCausa*(1-HONORARIOS_PCT_PADRAO))*(1-oferta.descontoPct)) : oferta.valorAntecipado)}</div>
            <div class="muted">Modalidade: ${labelEscolha(oferta.escolhaCessao || op.escolhaCessao)}</div>
          </div>
          <div class="alert mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>Status: <strong>aguardando preparação da assinatura pela equipe.</strong></div>
          </div>
          <div class="journey-actions">
            <a href="dashboard.html" class="btn btn--ghost">Voltar ao painel</a>
          </div>
        `;
        return;
      }

      const valorBase     = oferta.valorBaseCausa;
      const valorAntCheio = oferta.valorAntecipado;
      // Para cliente: pode escolher integral vs parcial
      // Para advogado (so_honorarios): só uma opção
      const honorariosVal = Math.round(valorBase * HONORARIOS_PCT_PADRAO);
      const parteCliente  = valorBase - honorariosVal;
      const desconto      = oferta.descontoPct;
      const ofertaParcial = Math.round(parteCliente * (1 - desconto));

      const escolha = op.escolhaCessao || (soHonorarios ? "so_honorarios" : "integral");

      target.innerHTML = `
        <h2>Sua proposta está pronta</h2>
        <p class="muted">
          ${adv
            ? "Conseguimos uma proposta para antecipar os seus honorários. Você recebe agora — a Just Já assume o risco e a espera."
            : "Conseguimos uma proposta para o seu processo. Você recebe agora — a Just Já assume o risco e a espera."}
        </p>

        <div class="card mt-3">
          <h3>O que identificamos</h3>
          <div class="grid grid--2 mt-2">
            <div>
              <div class="muted" style="font-size:.85rem;">${soHonorarios ? "Valor base dos honorários" : "Valor base da causa"}</div>
              <div style="font-weight:700; font-size:1.4rem;">${App.fmtBRL(valorBase)}</div>
            </div>
            <div>
              <div class="muted" style="font-size:.85rem;">Classe de risco</div>
              <div style="font-weight:700; font-size:1.4rem;">${a.classe}</div>
            </div>
          </div>
          <hr style="border:0; border-top:1px solid var(--ink-200); margin: 16px 0;">
          <div style="font-size:.95rem;">
            <strong>Fase atual:</strong> ${a.fase}<br>
            <strong>Última decisão:</strong> ${a.decisao}<br>
            <strong>Confiança da análise:</strong> ${(a.confianca*100).toFixed(0)}%
          </div>
        </div>

        ${!soHonorarios ? `
          <div class="alert alert--warn mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            <div>
              <strong>Importante — converse com o seu advogado(a):</strong>
              parte do valor da causa corresponde aos <strong>honorários advocatícios</strong>
              (estimados em ${App.fmtBRL(honorariosVal)}, ≈${(HONORARIOS_PCT_PADRAO*100).toFixed(0)}%).
              Você precisa decidir se quer antecipar o valor <strong>integral</strong> ou apenas a <strong>sua parte</strong>.
            </div>
          </div>

          <h3 class="mt-3">Escolha como quer antecipar</h3>
          <div class="grid grid--2 mt-2">
            <label class="card card--hover ${escolha==='integral'?'card--selected':''}" style="cursor:pointer;">
              <input type="radio" name="escolha" value="integral" ${escolha==='integral'?'checked':''} style="position:absolute; opacity:0;">
              <div class="muted" style="font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Cessão integral</div>
              <div class="sim__amount" style="font-size: 2rem;">${App.fmtBRL(valorAntCheio)}</div>
              <div class="muted">Antecipa <strong>tudo</strong> — valor seu + honorários do advogado.</div>
            </label>
            <label class="card card--hover ${escolha==='parcial'?'card--selected':''}" style="cursor:pointer;">
              <input type="radio" name="escolha" value="parcial" ${escolha==='parcial'?'checked':''} style="position:absolute; opacity:0;">
              <div class="muted" style="font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Só a sua parte</div>
              <div class="sim__amount" style="font-size: 2rem;">${App.fmtBRL(ofertaParcial)}</div>
              <div class="muted">Antecipa <strong>apenas a sua parte</strong> — os honorários ficam fora.</div>
            </label>
          </div>
        ` : `
          <div class="card mt-3" style="background: linear-gradient(135deg, var(--brand-50), #fff); border-color: var(--brand-100);">
            <div class="muted" style="font-size:.85rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Você recebe agora</div>
            <div class="sim__amount" style="font-size: 2.6rem;">${App.fmtBRL(valorAntCheio)}</div>
            <div class="muted">de um valor de honorários estimado de <strong>${App.fmtBRL(valorBase)}</strong></div>
          </div>
        `}

        <div class="muted mt-3" style="font-size:.82rem; max-width: 720px;">
          Validade da proposta: <strong>${oferta.validadeDias} dias</strong>.
          A proposta pode sofrer ajustes caso o valor informado seja diferente do calculado inicialmente pela análise.
        </div>

        <div class="journey-actions">
          <button class="btn btn--accent btn--lg" id="btn-aceitar">Aceitar proposta e seguir →</button>
          <button class="btn btn--ghost" id="btn-revisar">Pedir uma revisão</button>
          <button class="btn btn--link" id="btn-recusar">Não tenho interesse agora</button>
        </div>
      `;

      target.querySelectorAll('input[name="escolha"]').forEach(r => {
        r.addEventListener("change", async () => {
          op.escolhaCessao = r.value;
          await Operacoes.update(op.id, { escolhaCessao: r.value });
          await render(op);
        });
      });

      document.getElementById("btn-aceitar").onclick = async () => {
        const escolhaFinal = soHonorarios ? "so_honorarios" : (op.escolhaCessao || "integral");
        // Marca a oferta como aceita — mas NÃO avança a etapa.
        // Quem libera a assinatura é o backoffice (após ver o aceite).
        await Ofertas.aceitar(oferta.id, escolhaFinal);
        await Operacoes.update(op.id, { escolhaCessao: escolhaFinal });
        const fresh = await Operacoes.get(op.id);
        await render(fresh);
      };
      document.getElementById("btn-revisar").onclick = () => {
        alert("Pedido de revisão registrado. Nosso time entrará em contato em até 1 dia útil.");
      };
      document.getElementById("btn-recusar").onclick = async () => {
        if (confirm("Tem certeza que quer recusar a proposta?")) {
          await Operacoes.update(op.id, { estagio: "recusada", status: "recusada" });
          window.location.href = "dashboard.html";
        }
      };
    },

    // ---------- 4. ASSINATURA ----------
    async assinatura(target, op) {
      const oferta = await Ofertas.getCurrent(op.id);
      if (!oferta) {
        target.innerHTML = `<p>Não há oferta aceita ainda. <a href="?id=${op.id}&stage=oferta">Voltar</a></p>`;
        return;
      }

      // Se já assinou, mostra confirmação + espera (backoffice libera protocolação).
      const assinaturas = await Assinaturas.listByOperacao(op.id);
      if (assinaturas.length > 0) {
        const a0 = assinaturas[assinaturas.length - 1];
        target.innerHTML = `
          <h2>✅ Contrato assinado!</h2>
          <p class="muted">
            Recebemos a sua assinatura. Nossa equipe vai conferir e liberar a próxima etapa
            (protocolação do termo nos autos). Você será avisado(a) por e-mail.
          </p>
          <div class="card mt-3">
            <table style="width:100%; font-size:.96rem;">
              <tr><td class="muted">Assinado por:</td><td><strong>${a0.nomeDigitado || "—"}</strong></td></tr>
              <tr><td class="muted">Data:</td><td>${App.fmtDate(a0.assinadoEm)}</td></tr>
              <tr><td class="muted">Comprovante:</td><td>hash ${a0.hash || "—"}</td></tr>
            </table>
          </div>
          <div class="alert mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>Status: <strong>aguardando liberação da protocolação pela equipe.</strong></div>
          </div>
          <div class="journey-actions">
            <a href="dashboard.html" class="btn btn--ghost">Voltar ao painel</a>
          </div>
        `;
        return;
      }

      const escolha = op.escolhaCessao || "integral";
      const adv = isAdvogado(op);
      const tipoTermo = adv
        ? "Termo de cessão de honorários"
        : escolha === "parcial"
          ? "Termo de cessão parcial (apenas a parte do cliente)"
          : "Termo de cessão integral (valor cheio, incluindo honorários)";
      const valorFinal = escolha === "parcial"
        ? Math.round((oferta.valorBaseCausa * (1 - HONORARIOS_PCT_PADRAO)) * (1 - oferta.descontoPct))
        : oferta.valorAntecipado;

      target.innerHTML = `
        <h2>Assinatura do contrato</h2>
        <p class="muted">
          Vamos formalizar a cessão. Você assina o contrato com a Just Já e também o termo
          que será protocolado no processo${adv ? "" : " (com a anuência do seu advogado)"}.
        </p>

        <div class="card mt-3">
          <h3>Resumo da operação</h3>
          <table style="width:100%; font-size:.96rem;">
            <tr><td class="muted">Processo:</td><td>${op.processos?.numeroCnj || "—"}</td></tr>
            <tr><td class="muted">Tribunal:</td><td>${op.processos?.tribunal || "—"}</td></tr>
            <tr><td class="muted">${adv ? "Valor base dos honorários" : "Valor base da causa"}:</td><td><strong>${App.fmtBRL(oferta.valorBaseCausa)}</strong></td></tr>
            <tr><td class="muted">Modalidade:</td><td><strong>${tipoTermo}</strong></td></tr>
            <tr><td class="muted">Valor a receber agora:</td><td><strong>${App.fmtBRL(valorFinal)}</strong></td></tr>
          </table>
        </div>

        <div class="card mt-3">
          <h3>Documentos a assinar</h3>
          <ol>
            <li><strong>Contrato de cessão de crédito</strong> (cliente + Just Já) — base legal: Art. 286 do CC</li>
            <li><strong>${tipoTermo}</strong> — a ser juntado aos autos do processo</li>
          </ol>
          <p class="muted" style="font-size:.9rem;">
            Antes de assinar, baixe a minuta do termo abaixo, leia com calma${adv ? "" : " e mostre ao seu advogado"}.
            Em produção, a assinatura será eletrônica (certificado ICP-Brasil ou Clicksign/D4Sign).
          </p>
          <button type="button" class="btn btn--ghost mt-2" id="btn-baixar-minuta">
            📄 Baixar minuta do termo de cessão (PDF)
          </button>
        </div>

        <form class="form mt-3" id="form-sign">
          <div class="field">
            <label class="field__label" for="nome-completo">Digite seu nome completo para assinar</label>
            <input id="nome-completo" placeholder="Como aparece no seu RG/CPF" value="${Auth.currentUser().nome}" required>
          </div>
          <label class="checkbox">
            <input type="checkbox" required>
            <span>Li e concordo com os termos do contrato de cessão e do termo a ser protocolado nos autos.</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" required>
            <span>Confirmo que sou ${adv ? "o(a) advogado(a) constituído(a) no processo" : "a parte legítima do processo"} informado e que as informações prestadas são verdadeiras.</span>
          </label>
          <div class="journey-actions">
            <button type="submit" class="btn btn--accent btn--lg">Assinar contrato →</button>
            <button type="button" class="btn btn--ghost" id="btn-back">Voltar</button>
          </div>
        </form>
      `;

      // Adapta o objeto pro PDF (TermoCessao espera dados similares ao antigo `proc`)
      const procLikeParaPDF = {
        id: op.id,
        numeroCnj: op.processos?.numeroCnj,
        tribunal: op.processos?.tribunal,
        cpfTitular: op.cpfTitular,
        advogadoTexto: op.advogadoTexto,
        escolhaCessao: escolha,
        valorEstimado: op.valorEstimado,
        analise: { valorBaseCausa: oferta.valorBaseCausa },
        oferta: {
          valorAntecipadoFinal: valorFinal,
          valorAntecipadoIntegral: oferta.valorAntecipado,
        },
      };

      document.getElementById("btn-baixar-minuta").onclick = () => {
        TermoCessao.gerar(procLikeParaPDF, Auth.currentUser());
      };
      document.getElementById("btn-back").onclick = async () => await advance(op, "oferta");

      const formSign = document.getElementById("form-sign");
      const signBtn = formSign.querySelector("button[type=submit]");
      formSign.onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("nome-completo").value;
        signBtn.disabled = true;
        signBtn.textContent = "Assinando…";
        try {
          await Assinaturas.create({
            operacaoId: op.id,
            ofertaId: oferta.id,
            role: isAdvogado(op) ? "advogado_anuente" : "cedente",
            nomeDigitado: nome,
            ip: "client-side",
            hash: "demo-" + Math.random().toString(36).slice(2, 12),
          });
          // Assinou — NÃO avança. Backoffice libera a protocolação.
          const fresh = await Operacoes.get(op.id);
          await render(fresh);
        } catch (err) {
          console.error("Erro ao assinar:", err);
          const box = document.createElement("div");
          box.className = "alert alert--danger mt-2";
          box.innerHTML = `<div><strong>Erro ao assinar:</strong> ${err.message || err}<br>
            Se você é a equipe vendo a jornada de um cliente, a assinatura precisa ser feita pela conta do próprio cliente.</div>`;
          formSign.appendChild(box);
          signBtn.disabled = false;
          signBtn.textContent = "Assinar contrato →";
        }
      };
    },

    // ---------- 5. PROTOCOLAÇÃO ----------
    async protocolacao(target, op) {
      const recebido = !!op.protocolacao?.comprovanteEnviado;

      if (!recebido) {
        target.innerHTML = `
          <h2>Protocole o termo de cessão nos autos</h2>
          <p class="muted">
            Agora você ${isAdvogado(op) ? "" : "(ou seu advogado) "}precisa <strong>protocolar o termo de cessão</strong>
            no processo, juntando o documento aos autos via PJe / e-SAJ / sistema do tribunal.
            Esse passo dá publicidade à cessão e é o que garante que o valor, quando pago pelo tribunal, vá para a Just Já.
          </p>

          <div class="card mt-3">
            <h3>Como fazer (passo a passo)</h3>
            <ol>
              <li>Baixe o <strong>termo de cessão</strong> assinado (o link foi enviado para o seu e-mail).</li>
              ${isAdvogado(op) ? "" : "<li>Envie para o seu advogado(a) — combine com ele(a) quem vai protocolar.</li>"}
              <li>Faça a juntada no sistema do tribunal (PJe / e-SAJ / Projudi etc.).</li>
              <li>Salve o comprovante de protocolação (PDF gerado pelo sistema).</li>
              <li>Suba os dois documentos aqui embaixo.</li>
            </ol>
          </div>

          <form id="form-upload" class="form mt-3">
            <div class="field">
              <label class="field__label" for="termo-assinado">1) Termo de cessão assinado (PDF)</label>
              <input id="termo-assinado" type="file" accept=".pdf,.jpg,.jpeg,.png" required>
              <span class="field__hint">O termo que você baixou no passo anterior, agora com as assinaturas.</span>
            </div>
            <div class="field">
              <label class="field__label" for="comprovante">2) Comprovante de protocolação (PDF)</label>
              <input id="comprovante" type="file" accept=".pdf,.jpg,.jpeg,.png" required>
              <span class="field__hint">PDF gerado pelo PJe / e-SAJ após a juntada nos autos.</span>
            </div>
            <div class="field">
              <label class="field__label" for="protocolado-por">Quem protocolou?</label>
              <select id="protocolado-por">
                <option value="advogado">${isAdvogado(op) ? "Eu mesmo(a)" : "Meu advogado(a)"}</option>
                <option value="cliente">${isAdvogado(op) ? "Meu cliente" : "Eu mesmo(a)"}</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="numero-protocolo">Número do protocolo (opcional)</label>
              <input id="numero-protocolo" placeholder="Se aparecer no comprovante">
            </div>
            <div class="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <div>Tamanho máximo por arquivo: 10 MB.</div>
            </div>
            <div class="journey-actions">
              <button type="submit" class="btn btn--primary btn--lg">Enviar documentos →</button>
            </div>
          </form>
        `;

        const submitBtn = document.querySelector("#form-upload button[type=submit]");
        document.getElementById("form-upload").onsubmit = async (e) => {
          e.preventDefault();
          const termoFile       = document.getElementById("termo-assinado").files[0];
          const comprovanteFile = document.getElementById("comprovante").files[0];
          if (!termoFile || !comprovanteFile) return;
          for (const f of [termoFile, comprovanteFile]) {
            if (f.size > 10 * 1024 * 1024) {
              alert(`Arquivo "${f.name}" maior que 10 MB.`); return;
            }
          }
          submitBtn.disabled = true;
          submitBtn.textContent = "Enviando…";

          async function uploadOne(prefix, file) {
            const userId = Auth.currentUser().id;
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = `${userId}/${op.id}/${prefix}-${Date.now()}-${safe}`;
            const { error: upErr } = await Auth.client().storage
              .from("comprovantes")
              .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
            if (upErr) throw upErr;
            const { data: signed, error: signErr } = await Auth.client().storage
              .from("comprovantes")
              .createSignedUrl(path, 60 * 60 * 24 * 365);
            if (signErr) throw signErr;
            return { nome: file.name, tamanho: file.size, path, url: signed.signedUrl };
          }

          try {
            const [termo, comprovante] = await Promise.all([
              uploadOne("termo-assinado", termoFile),
              uploadOne("comprovante", comprovanteFile),
            ]);
            const protocolacao = {
              comprovanteEnviado: true,
              termoAssinadoNome: termo.nome,
              termoAssinadoTamanho: termo.tamanho,
              termoAssinadoPath: termo.path,
              termoAssinadoUrl: termo.url,
              comprovanteNome: comprovante.nome,
              comprovanteTamanho: comprovante.tamanho,
              comprovantePath: comprovante.path,
              comprovanteUrl: comprovante.url,
              protocoladoPor: document.getElementById("protocolado-por").value,
              numeroProtocolo: document.getElementById("numero-protocolo").value,
              enviadoEm: new Date().toISOString(),
              prazoAnaliseHoras: 24,
              prazoPagamentoHoras: 24,
            };
            await Operacoes.update(op.id, { protocolacao, pagamentoStatus: "no_carrinho" });
            op.protocolacao = protocolacao;
            op.pagamentoStatus = "no_carrinho";
            await render(op);
          } catch (err) {
            console.error("Upload falhou:", err);
            alert("Falha no upload: " + (err.message || err));
            submitBtn.disabled = false;
            submitBtn.textContent = "Enviar documentos →";
          }
        };
      } else {
        const p = op.protocolacao;
        target.innerHTML = `
          <h2>✅ Documentos recebidos</h2>
          <p class="muted">Tudo certo. Vamos validar e liberar o seu pagamento.</p>

          <div class="card mt-3" style="background: linear-gradient(135deg, var(--success-100), #fff); border-color: #86efac;">
            <h3>Documentos recebidos em ${App.fmtDate(p.enviadoEm)}</h3>
            <ul style="font-size:.95rem;">
              <li>📄 <strong>Termo de cessão assinado:</strong> <code>${p.termoAssinadoNome || "—"}</code>${p.termoAssinadoUrl ? ` — <a href="${p.termoAssinadoUrl}" target="_blank" rel="noopener">ver arquivo</a>` : ""}</li>
              <li>📑 <strong>Comprovante de protocolação:</strong> <code>${p.comprovanteNome || "—"}</code>${p.comprovanteUrl ? ` — <a href="${p.comprovanteUrl}" target="_blank" rel="noopener">ver arquivo</a>` : ""}</li>
            </ul>
            <hr style="border:0; border-top:1px solid rgba(0,0,0,.08); margin: 14px 0;">
            <ul style="font-size:.95rem;">
              <li>🔄 <strong>Análise dos documentos:</strong> em até <strong>${p.prazoAnaliseHoras} horas</strong></li>
              <li>💰 <strong>Liberação do pagamento:</strong> em até <strong>${p.prazoPagamentoHoras} horas</strong> após validação</li>
            </ul>
          </div>

          <div class="alert mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            <div>Seu pagamento agora está <strong>no carrinho</strong> da Just Já — aguardando a liberação interna.</div>
          </div>

          <div class="journey-actions">
            <a href="dashboard.html" class="btn btn--primary">Voltar ao painel</a>
          </div>
        `;
      }
    },

    // ---------- 6. PAGAMENTO ----------
    async pagamento(target, op) {
      const oferta = await Ofertas.getCurrent(op.id);
      const status = op.pagamentoStatus || "no_carrinho";
      const escolha = op.escolhaCessao || "integral";
      const valor = escolha === "parcial" && oferta
        ? Math.round((oferta.valorBaseCausa * (1 - HONORARIOS_PCT_PADRAO)) * (1 - oferta.descontoPct))
        : (oferta?.valorAntecipado || 0);

      if (status === "pago") {
        target.innerHTML = `
          <h2>🎉 Pagamento liberado</h2>
          <p class="muted">O PIX já saiu — confira o extrato da sua conta.</p>
          <div class="card mt-3" style="background: linear-gradient(135deg, var(--success-100), #fff); border-color: #86efac;">
            <h3>Valor pago</h3>
            <div class="sim__amount" style="color: var(--success-600); font-size: 2.6rem;">${App.fmtBRL(valor)}</div>
            <div class="muted">PIX enviado em ${App.fmtDate(op.pagamento?.pagoEm)}</div>
          </div>
          <div class="journey-actions">
            <a href="dashboard.html" class="btn btn--primary">Voltar ao painel</a>
          </div>
        `;
      } else {
        target.innerHTML = `
          <h2>Pagamento no carrinho</h2>
          <p class="muted">
            Seu pedido está na fila para liberação. Assim que o comprovante for validado,
            o PIX cai na sua conta cadastrada.
          </p>
          <div class="card mt-3">
            <h3>Resumo</h3>
            <table style="width:100%; font-size:.96rem;">
              <tr><td class="muted">Valor a receber:</td><td><strong>${App.fmtBRL(valor)}</strong></td></tr>
              <tr><td class="muted">Modalidade:</td><td>${labelEscolha(escolha)}</td></tr>
              <tr><td class="muted">Status:</td><td><span class="badge badge--warn">No carrinho — aguardando validação</span></td></tr>
              <tr><td class="muted">Previsão de pagamento:</td><td>até ${op.protocolacao?.prazoPagamentoHoras || 24}h após validação</td></tr>
            </table>
          </div>
          <div class="alert mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>A liberação do pagamento é feita pela equipe Just Já após a validação dos documentos.</div>
          </div>
          <div class="journey-actions">
            <a href="dashboard.html" class="btn btn--primary">Voltar ao painel</a>
          </div>
        `;
      }
    },
  };

  // ===========================================================================
  // Sub-renderers de Consulta + Análise
  // ===========================================================================
  function renderConsultaForm(target, op) {
    const adv = isAdvogado(op);
    let modo = op._modoInfoProcesso || "numero"; // estado de UI (não persiste)

    target.innerHTML = `
      <h2>Informe o seu processo</h2>
      <p class="muted">
        Escolha como prefere nos passar o processo. Depois é só autorizar a consulta —
        a nossa equipe analisa e prepara a proposta.
      </p>

      <div class="view-toggle mt-2" id="proc-tabs" style="margin-bottom: 4px;">
        <button type="button" data-modo="numero" class="${modo==='numero'?'active':''}">Por número (CNJ)</button>
        <button type="button" data-modo="anexar" class="${modo==='anexar'?'active':''}">Anexar processo</button>
        <button type="button" data-modo="cpf" disabled title="Em breve" style="opacity:.5; cursor:not-allowed;">Buscar por CPF (em breve)</button>
      </div>

      <form class="form mt-3" id="form-consulta">
        <div id="painel-numero" class="${modo==='numero'?'':'hide'}">
          <div class="field">
            <label class="field__label" for="cnj">Número do processo (CNJ)</label>
            <input id="cnj" placeholder="0000000-00.0000.0.00.0000" value="${op.processos?.numeroCnj || ""}">
            <span class="field__hint">Você encontra na intimação ou no sistema do tribunal.</span>
          </div>
        </div>

        <div id="painel-anexar" class="${modo==='anexar'?'':'hide'}">
          <div class="field">
            <label class="field__label" for="anexo">Documento do processo (PDF ou imagem)</label>
            <input id="anexo" type="file" accept=".pdf,.jpg,.jpeg,.png">
            <span class="field__hint">Pode ser a petição inicial, a sentença ou um print dos autos. Máx 10 MB.</span>
          </div>
        </div>

        <div id="painel-cpf" class="${modo==='cpf'?'':'hide'}">
          <div class="alert alert--warn"><div>A busca automática por CPF (com autodeclaração do cliente) chega em breve. Por enquanto use "Por número" ou "Anexar".</div></div>
        </div>

        <div class="field">
          <label class="field__label" for="cpf-consulta">${adv ? "CPF do(a) seu(sua) cliente" : "Seu CPF"}</label>
          <input id="cpf-consulta" placeholder="000.000.000-00" value="${op.cpfTitular || ""}" required>
          <span class="field__hint">${adv ? "Confirma a parte do processo." : "Confirma que você é parte do processo."}</span>
        </div>

        ${!adv ? `
          <div class="field">
            <label class="field__label" for="advogado">Nome do(a) seu(sua) advogado(a)</label>
            <input id="advogado" placeholder="Nome completo" value="${op.advogadoTexto || ""}">
            <span class="field__hint">Para contatá-lo(a) sobre a cessão. Opcional nesta etapa.</span>
          </div>
        ` : ""}

        <div class="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v6c0 5 4 9 10 11 6-2 10-6 10-11V7l-10-5z"/></svg>
          <div>
            <strong>Autorização de consulta</strong><br>
            Ao continuar, você autoriza a Just Já a consultar os andamentos do processo nos sistemas
            públicos do tribunal, com a única finalidade de avaliar a viabilidade da antecipação. Nenhum
            dado é compartilhado com terceiros. Veja nossa
            <a href="../privacidade.html" target="_blank" style="color:inherit; text-decoration:underline;">política de privacidade</a>.
            <label class="checkbox" style="margin-top:12px;">
              <input type="checkbox" id="autorizo" required>
              <span>Eu autorizo a consulta ao processo informado.</span>
            </label>
          </div>
        </div>

        <div class="journey-actions">
          <button type="submit" class="btn btn--primary btn--lg">Autorizar e enviar para análise →</button>
          <button type="button" class="btn btn--ghost" id="btn-back">Voltar ao cadastro</button>
        </div>
      </form>
    `;

    App.bindMask(document.getElementById("cnj"), App.maskCNJ);
    App.bindMask(document.getElementById("cpf-consulta"), App.maskCPF);
    document.getElementById("btn-back").onclick = async () => await advance(op, "cadastro");

    // Troca de aba (sem re-render, preserva o que já foi digitado)
    target.querySelectorAll("#proc-tabs button[data-modo]").forEach(b => {
      b.addEventListener("click", () => {
        if (b.disabled) return;
        modo = b.dataset.modo;
        op._modoInfoProcesso = modo;
        target.querySelectorAll("#proc-tabs button[data-modo]").forEach(x => x.classList.toggle("active", x.dataset.modo === modo));
        document.getElementById("painel-numero").classList.toggle("hide", modo !== "numero");
        document.getElementById("painel-anexar").classList.toggle("hide", modo !== "anexar");
        document.getElementById("painel-cpf").classList.toggle("hide", modo !== "cpf");
      });
    });

    const submitBtn = document.querySelector("#form-consulta button[type=submit]");
    function showErr(msg) {
      let box = document.getElementById("consulta-err");
      if (!box) {
        box = document.createElement("div");
        box.id = "consulta-err";
        box.className = "alert alert--danger mt-2";
        document.getElementById("form-consulta").appendChild(box);
      }
      box.innerHTML = `<div>${msg}</div>`;
    }

    document.getElementById("form-consulta").onsubmit = async (e) => {
      e.preventDefault();
      if (!document.getElementById("autorizo").checked) return;
      const cpf = document.getElementById("cpf-consulta").value;
      const advEl = document.getElementById("advogado");
      const advogadoTexto = advEl ? advEl.value : null;
      const cnj = (modo === "numero") ? (document.getElementById("cnj").value || "").trim() : "";
      const anexoFile = (modo === "anexar") ? document.getElementById("anexo").files[0] : null;

      if (modo === "numero" && !cnj) { showErr("Informe o número do processo (CNJ)."); return; }
      if (modo === "anexar" && !anexoFile) { showErr("Anexe o documento do processo."); return; }
      if (anexoFile && anexoFile.size > 10 * 1024 * 1024) { showErr("Arquivo maior que 10 MB."); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";

      try {
        // Processo: buscar/criar pelo CNJ (quando informado)
        let processoId = op.processoId;
        if (cnj) {
          const existente = await Processos.getByCnj(cnj);
          if (existente) { processoId = existente.id; await Operacoes.update(op.id, { processoId }); }
          else if (processoId) { await Processos.update(processoId, { numeroCnj: cnj }); }
          else { const novo = await Processos.create({ numeroCnj: cnj }); processoId = novo.id; await Operacoes.update(op.id, { processoId }); }
        }

        // Anexo do processo → Storage
        let anexoInfo = null;
        if (anexoFile) {
          const userId = Auth.currentUser().id;
          const safe = anexoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${userId}/${op.id}/processo-${Date.now()}-${safe}`;
          const { error: upErr } = await Auth.client().storage
            .from("comprovantes")
            .upload(path, anexoFile, { cacheControl: "3600", upsert: false, contentType: anexoFile.type || "application/octet-stream" });
          if (upErr) throw upErr;
          const { data: signed } = await Auth.client().storage
            .from("comprovantes").createSignedUrl(path, 60 * 60 * 24 * 365);
          anexoInfo = { nome: anexoFile.name, path, url: signed?.signedUrl, enviadoEm: new Date().toISOString() };
        }

        // Marca como "aguardando equipe" — SEM gerar oferta (backoffice faz isso)
        await Operacoes.update(op.id, {
          cpfTitular: cpf,
          advogadoTexto,
          anexoProcesso: anexoInfo,
          autorizouConsulta: true,
          autorizadoEm: new Date().toISOString(),
          analiseStatus: "aguardando_equipe",
        });

        const fresh = await Operacoes.get(op.id);
        await render(fresh);
      } catch (err) {
        console.error("Erro ao enviar para análise:", err);
        showErr(`<strong>Erro:</strong> ${err.message || err}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "Autorizar e enviar para análise →";
      }
    };
  }

  // Tela de espera: análise é feita pela equipe (backoffice), não automática.
  function renderAguardandoEquipe(target, op) {
    target.innerHTML = `
      <h2>Recebemos o seu processo! 🎯</h2>
      <p class="muted">
        A nossa equipe vai analisar o seu processo e preparar uma proposta de antecipação.
        Você será avisado(a) por e-mail em <strong>${Auth.currentUser().email}</strong> assim que
        a proposta estiver pronta.
      </p>
      <div class="card mt-3">
        <h3>O que acontece agora</h3>
        <ul style="font-size:.96rem;">
          <li>🔎 Consultamos o andamento e analisamos o seu processo.</li>
          <li>💡 Geramos uma proposta de antecipação personalizada.</li>
          <li>📩 Você recebe um aviso para ver e aceitar a proposta.</li>
        </ul>
        <p class="muted" style="font-size:.88rem; margin: 8px 0 0;">Prazo típico: de algumas horas a 1 dia útil.</p>
      </div>
      <div class="alert mt-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div>Status atual: <strong>Em análise pela equipe.</strong></div>
      </div>
      <div class="journey-actions">
        <a href="dashboard.html" class="btn btn--primary">Voltar ao painel</a>
      </div>
    `;
  }

  function labelEscolha(escolha) {
    return ({
      integral: "Cessão integral",
      parcial:  "Só a sua parte",
      so_honorarios: "Cessão de honorários",
    })[escolha] || escolha;
  }

  return { ESTAGIOS, TRIBUNAIS, render, loadOperacao, advance };
})();

window.Jornada = Jornada;
