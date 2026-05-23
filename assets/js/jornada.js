/* ==========================================================================
   Just Já — Jornada de antecipação (6 estágios)
   --------------------------------------------------------------------------
   Estágios visíveis no stepper:
     1. cadastro         — apelido, tipo (cível), tribunal, valor declarado
     2. consultaAnalise  — autorização + CNJ + análise (síncrona ou assíncrona)
     3. oferta           — proposta + escolha integral × parte do cliente
     4. assinatura       — contrato de cessão + termo de cessão
     5. protocolacao     — upload do comprovante feito pelo cliente/advogado
     6. pagamento        — status do PIX (no "carrinho")
   ========================================================================== */

const Jornada = (() => {
  const ESTAGIOS = [
    { id: "cadastro",        label: "Cadastro" },
    { id: "consultaAnalise", label: "Consulta e Análise" },
    { id: "oferta",          label: "Oferta" },
    { id: "assinatura",      label: "Assinatura" },
    { id: "protocolacao",    label: "Protocolação" },
    { id: "pagamento",       label: "Pagamento" },
  ];

  // Lista placeholder de tribunais — começa por JEC e dá opção "Outros".
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

  // Honorários padrão estimados (substituído pela análise real em produção)
  const HONORARIOS_PCT_PADRAO = 0.30;

  function idxOf(stage) {
    return ESTAGIOS.findIndex(e => e.id === stage);
  }

  function renderStepper(target, currentStage) {
    const cur = idxOf(currentStage);
    target.innerHTML = ESTAGIOS.map((e, i) => {
      const cls = i < cur ? "done" : i === cur ? "current" : "";
      return `
        <div class="stepper__item ${cls}">
          <div class="stepper__num">${i < cur ? "✓" : i + 1}</div>
          <div>${e.label}</div>
        </div>`;
    }).join("");
  }

  function getQueryProcId() {
    return new URL(window.location.href).searchParams.get("id");
  }

  function loadProcesso() {
    const user = Auth.currentUser();
    if (!user) return null;
    const id = getQueryProcId();
    if (!id) return null;
    return App.getProcesso(user.email, id);
  }

  function saveProcesso(proc) {
    const user = Auth.currentUser();
    if (!user) return;
    App.upsertProcesso(user.email, proc);
  }

  function advance(proc, nextStage) {
    proc.estagio = nextStage;
    proc.historico = proc.historico || [];
    proc.historico.push({ estagio: nextStage, at: new Date().toISOString() });
    saveProcesso(proc);
    window.location.href = `jornada.html?id=${proc.id}&stage=${nextStage}`;
  }

  function getStageFromQueryOrProc(proc) {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("stage");
    if (q && ESTAGIOS.find(e => e.id === q)) return q;
    return proc?.estagio || "cadastro";
  }

  // Hash determinístico do id pra decidir sync vs async (40% async)
  function isAsyncAnalise(proc) {
    const seed = (proc.id || "").replace(/\D/g, "").slice(-2);
    const n = parseInt(seed || "50", 10);
    return n < 40;
  }

  function render(proc) {
    const stage = getStageFromQueryOrProc(proc);
    const target  = document.getElementById("journey-content");
    const stepper = document.getElementById("journey-stepper");
    renderStepper(stepper, stage);
    const renderer = RENDERERS[stage] || RENDERERS.cadastro;
    renderer(target, proc);
  }

  const RENDERERS = {
    // ---------- 1. CADASTRO ----------
    cadastro(target, proc) {
      const tribunaisOpts = TRIBUNAIS.map(t => {
        const sel = proc.tribunal === t ? "selected" : "";
        return `<option value="${t}" ${sel}>${t}</option>`;
      }).join("");
      const outrosSel = proc.tribunal && !TRIBUNAIS.includes(proc.tribunal) ? "selected" : "";

      target.innerHTML = `
        <h2>Vamos cadastrar o seu processo</h2>
        <p class="muted">
          Preencha as informações abaixo. Não precisa ser exato agora — você pode ajustar depois,
          mas quanto mais correto melhor é a análise.
        </p>

        <form id="form-cadastro" class="form mt-3">
          <div class="field">
            <label class="field__label" for="c-titulo">Como você quer chamar este processo? (apelido)</label>
            <input id="c-titulo" placeholder="Ex.: Voo cancelado Latam — out/24" value="${proc.titulo || ""}" required>
            <span class="field__hint">É só para você se localizar no painel.</span>
          </div>

          <div class="field--row">
            <div class="field">
              <label class="field__label" for="c-tipo">Tipo do processo</label>
              <select id="c-tipo" required>
                <option value="aereo" ${proc.tipo==="aereo"?"selected":""}>Direito Aéreo</option>
                <option value="consumidor" ${proc.tipo==="consumidor"?"selected":""}>Consumidor</option>
                <option value="bancario" ${proc.tipo==="bancario"?"selected":""}>Bancário</option>
                <option value="outras" ${proc.tipo==="outras"?"selected":""}>Outras relações de consumo</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="c-valor">Valor estimado a receber</label>
              <input id="c-valor" data-sim-valor inputmode="numeric" placeholder="R$ 0,00" value="${proc.valorEstimado ? App.fmtBRL(proc.valorEstimado) : ""}" required>
              <span class="field__hint">Use o valor total que está na ação ou que seu advogado estimou.</span>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="c-tribunal">Tribunal / Vara</label>
            <select id="c-tribunal" required>
              <option value="">Selecione...</option>
              ${tribunaisOpts}
              <option value="__outros__" ${outrosSel}>Outros (digitar manualmente)</option>
            </select>
            <input id="c-tribunal-outros" class="mt-1 ${outrosSel ? "" : "hide"}" placeholder="Digite o tribunal/vara" value="${outrosSel ? proc.tribunal : ""}">
          </div>

          <div class="field">
            <label class="field__label" for="c-descricao">Conte rapidamente o que aconteceu (opcional)</label>
            <textarea id="c-descricao" rows="3" placeholder="Ex.: Voo Latam cancelado sem aviso, comprei outra passagem do meu bolso...">${proc.descricao || ""}</textarea>
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

      document.getElementById("form-cadastro").onsubmit = (e) => {
        e.preventDefault();
        const titulo = document.getElementById("c-titulo").value.trim();
        const tipo   = document.getElementById("c-tipo").value;
        const valor  = App.parseBRL(valorEl.value);
        const tribunal = tribSel.value === "__outros__"
          ? tribOutros.value.trim()
          : tribSel.value;
        const descricao = document.getElementById("c-descricao").value.trim();

        proc.titulo = titulo;
        proc.tipo = tipo;
        proc.valorEstimado = valor;
        proc.tribunal = tribunal;
        proc.descricao = descricao;
        // estimativa preliminar (placeholder do motor de pricing)
        proc.estimativa = Simulador.estimar({ valor, tipo });
        saveProcesso(proc);
        advance(proc, "consultaAnalise");
      };
    },

    // ---------- 2. CONSULTA + ANÁLISE ----------
    consultaAnalise(target, proc) {
      const sub = proc.analiseStatus || "form";

      if (sub === "form") {
        return renderConsultaForm(target, proc);
      }
      if (sub === "processando") {
        return renderProcessando(target, proc);
      }
      if (sub === "aguardando_async") {
        return renderAguardandoAsync(target, proc);
      }
      return renderConsultaForm(target, proc);
    },

    // ---------- 3. OFERTA ----------
    oferta(target, proc) {
      const o = proc.oferta;
      const a = proc.analise;
      if (!o) {
        target.innerHTML = `<p>Oferta indisponível. <a href="?id=${proc.id}&stage=consultaAnalise">Voltar à análise</a></p>`;
        return;
      }
      const valorBase = a.valorBaseCausa;
      const honorariosVal = Math.round(valorBase * HONORARIOS_PCT_PADRAO);
      const parteClienteVal = valorBase - honorariosVal;

      // Oferta integral × parcial
      const ofertaIntegral = o.valorAntecipadoIntegral;
      const ofertaParcial  = o.valorAntecipadoParcial;
      const escolha = proc.escolhaCessao || "integral";

      target.innerHTML = `
        <h2>Sua proposta está pronta</h2>
        <p class="muted">
          Boa notícia! Conseguimos uma proposta para o seu processo. Você recebe agora —
          e a Just Já assume o risco e a espera.
        </p>

        <div class="card mt-3">
          <h3>O que identificamos no seu processo</h3>
          <div class="grid grid--2 mt-2">
            <div>
              <div class="muted" style="font-size:.85rem;">Valor base da causa (calculado pela análise)</div>
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

        <div class="alert alert--warn mt-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          <div>
            <strong>Importante — converse com o seu advogado(a):</strong>
            parte do valor da causa corresponde aos <strong>honorários advocatícios</strong>
            (estimados em ${App.fmtBRL(honorariosVal)}, ≈${(HONORARIOS_PCT_PADRAO*100).toFixed(0)}%).
            Você precisa decidir, junto com o seu advogado(a), se quer antecipar o valor
            <strong>integral</strong> (incluindo honorários) ou apenas a <strong>sua parte</strong>
            (sem honorários). Essa escolha define qual termo de cessão será gerado.
          </div>
        </div>

        <h3 class="mt-3">Escolha como quer antecipar</h3>
        <div class="grid grid--2 mt-2">
          <label class="card card--hover ${escolha==='integral'?'card--selected':''}" style="cursor:pointer; ${escolha==='integral'?'border-color: var(--brand-700); box-shadow: 0 0 0 4px var(--brand-100);':''}">
            <input type="radio" name="escolha" value="integral" ${escolha==='integral'?'checked':''} style="position:absolute; opacity:0;">
            <div class="muted" style="font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Cessão integral</div>
            <div class="sim__amount" style="font-size: 2rem;">${App.fmtBRL(ofertaIntegral)}</div>
            <div class="muted">Antecipa <strong>tudo</strong> — valor seu + honorários do advogado.</div>
            <div class="muted mt-1" style="font-size:.85rem;">
              Base: ${App.fmtBRL(valorBase)} · Sua parte é paga em PIX; honorários vão para o(a) advogado(a) conforme combinado entre vocês.
            </div>
          </label>
          <label class="card card--hover ${escolha==='parcial'?'card--selected':''}" style="cursor:pointer; ${escolha==='parcial'?'border-color: var(--brand-700); box-shadow: 0 0 0 4px var(--brand-100);':''}">
            <input type="radio" name="escolha" value="parcial" ${escolha==='parcial'?'checked':''} style="position:absolute; opacity:0;">
            <div class="muted" style="font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600;">Só a sua parte</div>
            <div class="sim__amount" style="font-size: 2rem;">${App.fmtBRL(ofertaParcial)}</div>
            <div class="muted">Antecipa <strong>apenas a sua parte</strong> — os honorários ficam fora.</div>
            <div class="muted mt-1" style="font-size:.85rem;">
              Base sua parte: ${App.fmtBRL(parteClienteVal)} · O(a) advogado(a) continua recebendo no fim do processo, no fluxo normal.
            </div>
          </label>
        </div>

        <div class="muted mt-3" style="font-size:.82rem; max-width: 720px;">
          Validade da proposta: <strong>${o.validadeDias} dias</strong>.
          A proposta pode sofrer ajustes caso o valor informado seja diferente do calculado inicialmente pela análise.
        </div>

        <div class="journey-actions">
          <button class="btn btn--accent btn--lg" id="btn-aceitar">Aceitar proposta e seguir →</button>
          <button class="btn btn--ghost" id="btn-revisar">Pedir uma revisão</button>
          <button class="btn btn--link" id="btn-recusar">Não tenho interesse agora</button>
        </div>
      `;

      // Seleção de cartões (radio visual)
      target.querySelectorAll('input[name="escolha"]').forEach(r => {
        r.addEventListener("change", () => {
          proc.escolhaCessao = r.value;
          saveProcesso(proc);
          render(proc);
        });
      });

      document.getElementById("btn-aceitar").onclick = () => {
        proc.escolhaCessao = proc.escolhaCessao || "integral";
        proc.oferta.valorAntecipadoFinal = proc.escolhaCessao === "integral"
          ? ofertaIntegral : ofertaParcial;
        saveProcesso(proc);
        advance(proc, "assinatura");
      };
      document.getElementById("btn-revisar").onclick = () => {
        alert("Pedido de revisão registrado. Nosso time entrará em contato em até 1 dia útil.");
      };
      document.getElementById("btn-recusar").onclick = () => {
        if (confirm("Tem certeza que quer recusar a proposta?")) {
          proc.estagio = "recusada";
          saveProcesso(proc);
          window.location.href = "dashboard.html";
        }
      };
    },

    // ---------- 4. ASSINATURA ----------
    assinatura(target, proc) {
      const tipoTermo = proc.escolhaCessao === "parcial"
        ? "Termo de cessão parcial (apenas a parte do cliente, sem honorários)"
        : "Termo de cessão integral (valor cheio, incluindo honorários)";

      target.innerHTML = `
        <h2>Assinatura do contrato</h2>
        <p class="muted">
          Vamos formalizar a cessão. Você assina o contrato com a Just Já e também o termo de cessão
          que será protocolado no seu processo (com a anuência do seu advogado).
        </p>

        <div class="card mt-3">
          <h3>Resumo da operação</h3>
          <table style="width:100%; font-size:.96rem;">
            <tr><td class="muted">Processo:</td><td>${proc.numeroCnj || "—"}</td></tr>
            <tr><td class="muted">Tribunal:</td><td>${proc.tribunal || "—"}</td></tr>
            <tr><td class="muted">Valor base da causa:</td><td><strong>${App.fmtBRL(proc.analise.valorBaseCausa)}</strong></td></tr>
            <tr><td class="muted">Modalidade escolhida:</td><td><strong>${proc.escolhaCessao === "integral" ? "Cessão integral" : "Só a sua parte"}</strong></td></tr>
            <tr><td class="muted">Valor a receber agora:</td><td><strong>${App.fmtBRL(proc.oferta.valorAntecipadoFinal)}</strong></td></tr>
          </table>
        </div>

        <div class="card mt-3">
          <h3>Documentos a assinar</h3>
          <ol>
            <li><strong>Contrato de cessão de crédito</strong> (cliente + Just Já) — base legal: Art. 286 do CC</li>
            <li><strong>${tipoTermo}</strong> — a ser juntado aos autos do processo (cliente + advogado + Just Já)</li>
          </ol>
          <p class="muted" style="font-size:.9rem;">
            Na versão de produção, os documentos serão assinados eletronicamente com certificado ICP-Brasil
            ou plataforma equivalente (Clicksign / D4Sign). Aqui na demo, simulamos com a sua confirmação.
          </p>
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
            <span>Confirmo que sou a parte legítima do processo informado e que as informações prestadas são verdadeiras.</span>
          </label>
          <div class="journey-actions">
            <button type="submit" class="btn btn--accent btn--lg">Assinar contrato →</button>
            <button type="button" class="btn btn--ghost" id="btn-back">Voltar</button>
          </div>
        </form>
      `;
      document.getElementById("btn-back").onclick = () => advance(proc, "oferta");
      document.getElementById("form-sign").onsubmit = (e) => {
        e.preventDefault();
        proc.assinatura = {
          nome: document.getElementById("nome-completo").value,
          assinadoEm: new Date().toISOString(),
          ip: "mock-ip-127.0.0.1",
          hash: "mock-hash-" + Math.random().toString(36).slice(2, 12),
          tipoTermo,
        };
        saveProcesso(proc);
        advance(proc, "protocolacao");
      };
    },

    // ---------- 5. PROTOCOLAÇÃO (upload pelo cliente/advogado) ----------
    protocolacao(target, proc) {
      const recebido = !!proc.protocolacao?.comprovanteEnviado;

      if (!recebido) {
        target.innerHTML = `
          <h2>Protocole o termo de cessão nos autos</h2>
          <p class="muted">
            Agora você (ou seu advogado) precisa <strong>protocolar o termo de cessão</strong> no
            processo, juntando o documento aos autos via PJe / e-SAJ / sistema do tribunal.
            Esse passo dá publicidade à cessão e é o que garante que o valor, quando pago pelo tribunal,
            vá para a Just Já — por isso a gente consegue te antecipar o dinheiro.
          </p>

          <div class="card mt-3">
            <h3>Como fazer (passo a passo)</h3>
            <ol>
              <li>Baixe o <strong>termo de cessão</strong> assinado (o link foi enviado para o seu e-mail).</li>
              <li>Envie para o seu advogado(a) — combine com ele(a) quem vai protocolar.</li>
              <li>Faça a juntada no sistema do tribunal (PJe / e-SAJ / Projudi etc.).</li>
              <li>Salve o comprovante de protocolação (PDF gerado pelo sistema).</li>
              <li>Suba o comprovante aqui embaixo.</li>
            </ol>
            <p class="muted" style="font-size:.9rem;">
              Se preferir que a gente acompanhe diretamente com o seu advogado(a),
              fale com nosso suporte: <a href="../index.html#contato">enviar mensagem</a>.
            </p>
          </div>

          <form id="form-upload" class="form mt-3">
            <div class="field">
              <label class="field__label" for="comprovante">Comprovante de protocolação (PDF)</label>
              <input id="comprovante" type="file" accept=".pdf,.jpg,.jpeg,.png" required>
              <span class="field__hint">Tamanho máximo: 10 MB. Pode ser o PDF do PJe ou um print legível.</span>
            </div>
            <div class="field">
              <label class="field__label" for="protocolado-por">Quem protocolou?</label>
              <select id="protocolado-por">
                <option value="advogado">Meu advogado(a)</option>
                <option value="cliente">Eu mesmo(a)</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="numero-protocolo">Número do protocolo (opcional)</label>
              <input id="numero-protocolo" placeholder="Se aparecer no comprovante">
            </div>
            <div class="journey-actions">
              <button type="submit" class="btn btn--primary btn--lg">Enviar comprovante →</button>
            </div>
          </form>
        `;
        document.getElementById("form-upload").onsubmit = (e) => {
          e.preventDefault();
          const file = document.getElementById("comprovante").files[0];
          proc.protocolacao = {
            comprovanteEnviado: true,
            comprovanteNome: file ? file.name : "comprovante.pdf",
            comprovanteTamanho: file ? file.size : 0,
            protocoladoPor: document.getElementById("protocolado-por").value,
            numeroProtocolo: document.getElementById("numero-protocolo").value,
            enviadoEm: new Date().toISOString(),
            // mock prazos (em produção vêm do backend)
            prazoAnaliseHoras: 24,
            prazoPagamentoHoras: 48,
          };
          // pagamento entra na "fila" / "carrinho"
          proc.pagamentoStatus = "no_carrinho";
          saveProcesso(proc);
          render(proc); // re-render mostrando estado "recebido"
        };
      } else {
        const p = proc.protocolacao;
        target.innerHTML = `
          <h2>✅ Comprovante recebido</h2>
          <p class="muted">Tudo certo. Vamos validar e liberar o seu pagamento.</p>

          <div class="card mt-3" style="background: linear-gradient(135deg, var(--success-100), #fff); border-color: #86efac;">
            <h3>Status do seu pedido</h3>
            <ul style="font-size:.95rem;">
              <li>✅ <strong>Comprovante recebido</strong> em ${App.fmtDate(p.enviadoEm)} — arquivo: <code>${p.comprovanteNome}</code></li>
              <li>🔄 <strong>Análise do comprovante:</strong> em até <strong>${p.prazoAnaliseHoras} horas úteis</strong></li>
              <li>💰 <strong>Liberação do pagamento:</strong> em até <strong>${p.prazoPagamentoHoras} horas úteis</strong> após validação</li>
            </ul>
          </div>

          <div class="alert mt-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            <div>
              Seu pagamento agora está <strong>no carrinho</strong> da Just Já — aguardando a liberação interna.
              Você pode acompanhar o status na próxima tela ou pelo painel.
            </div>
          </div>

          <div class="journey-actions">
            <button class="btn btn--primary btn--lg" id="btn-pgto">Acompanhar pagamento →</button>
            <a href="dashboard.html" class="btn btn--ghost">Voltar ao painel</a>
          </div>
        `;
        document.getElementById("btn-pgto").onclick = () => advance(proc, "pagamento");
      }
    },

    // ---------- 6. PAGAMENTO ----------
    pagamento(target, proc) {
      const status = proc.pagamentoStatus || "no_carrinho";
      const valor = proc.oferta?.valorAntecipadoFinal || proc.oferta?.valorAntecipadoIntegral || 0;

      if (status === "pago") {
        target.innerHTML = `
          <h2>🎉 Pagamento liberado</h2>
          <p class="muted">O PIX já saiu — confira o extrato da sua conta.</p>
          <div class="card mt-3" style="background: linear-gradient(135deg, var(--success-100), #fff); border-color: #86efac;">
            <h3>Valor pago</h3>
            <div class="sim__amount" style="color: var(--success-600); font-size: 2.6rem;">${App.fmtBRL(valor)}</div>
            <div class="muted">PIX enviado em ${App.fmtDate(proc.pagamento?.pagoEm)}</div>
          </div>
          <div class="card mt-3">
            <h3>O que vem agora?</h3>
            <ul>
              <li>Você não precisa fazer mais nada.</li>
              <li>A Just Já acompanha o seu processo até o pagamento final pelo tribunal.</li>
              <li>Dúvidas: <a href="../index.html#contato">fale com a gente</a>.</li>
            </ul>
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
            o PIX cai na sua conta cadastrada (chave CPF).
          </p>
          <div class="card mt-3">
            <h3>Resumo</h3>
            <table style="width:100%; font-size:.96rem;">
              <tr><td class="muted">Valor a receber:</td><td><strong>${App.fmtBRL(valor)}</strong></td></tr>
              <tr><td class="muted">Modalidade:</td><td>${proc.escolhaCessao === "integral" ? "Cessão integral" : "Só a sua parte"}</td></tr>
              <tr><td class="muted">Status:</td><td><span class="badge badge--warn">No carrinho — aguardando validação</span></td></tr>
              <tr><td class="muted">Previsão de pagamento:</td><td>até ${proc.protocolacao?.prazoPagamentoHoras || 48}h úteis após validação</td></tr>
            </table>
          </div>
          <div class="journey-actions">
            <button class="btn btn--primary btn--lg" id="btn-simular-pago">[demo] Simular pagamento liberado</button>
            <a href="dashboard.html" class="btn btn--ghost">Voltar ao painel</a>
          </div>
        `;
        document.getElementById("btn-simular-pago").onclick = () => {
          proc.pagamentoStatus = "pago";
          proc.pagamento = { pagoEm: new Date().toISOString(), valor };
          proc.status = "concluido";
          saveProcesso(proc);
          render(proc);
        };
      }
    },
  };

  // ---------- Sub-renderers de Consulta + Análise ----------

  function renderConsultaForm(target, proc) {
    target.innerHTML = `
      <h2>Vamos consultar o seu processo</h2>
      <p class="muted">
        Precisamos do número do processo e da sua autorização para consultar os andamentos junto ao
        <strong>DJEN/CNJ</strong> e <strong>DataJud</strong>. Nenhum dado pessoal é exposto — usamos
        apenas as informações públicas do processo.
      </p>

      <form class="form mt-3" id="form-consulta">
        <div class="field">
          <label class="field__label" for="cnj">Número do processo (CNJ)</label>
          <input id="cnj" placeholder="0000000-00.0000.0.00.0000" value="${proc.numeroCnj || ""}" required>
          <span class="field__hint">Você encontra esse número na intimação ou com seu advogado.</span>
        </div>

        <div class="field">
          <label class="field__label" for="advogado">Seu advogado(a) — nome e OAB</label>
          <input id="advogado" placeholder="Nome completo + UF/00000" value="${proc.advogadoTexto || ""}">
          <span class="field__hint">Para que possamos contatá-lo(a) sobre a cessão. Opcional nesta etapa.</span>
        </div>

        <div class="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v6c0 5 4 9 10 11 6-2 10-6 10-11V7l-10-5z"/></svg>
          <div>
            <strong>Autorização de consulta</strong><br>
            Ao continuar, você autoriza a Just Já a consultar os andamentos do processo nos sistemas
            públicos do CNJ (DJEN, DataJud) com a única finalidade de avaliar a viabilidade da antecipação.
            Nenhum dado é compartilhado com terceiros. Veja nossa
            <a href="../privacidade.html" target="_blank" style="color:inherit; text-decoration:underline;">política de privacidade</a>.
            <label class="checkbox" style="margin-top:12px;">
              <input type="checkbox" id="autorizo" required>
              <span>Eu autorizo a consulta nos sistemas públicos do CNJ e declaro que sou parte legítima neste processo.</span>
            </label>
          </div>
        </div>

        <div class="journey-actions">
          <button type="submit" class="btn btn--primary btn--lg">Autorizar e iniciar análise →</button>
          <button type="button" class="btn btn--ghost" id="btn-back">Voltar ao cadastro</button>
        </div>
      </form>
    `;
    App.bindMask(document.getElementById("cnj"), App.maskCNJ);
    document.getElementById("btn-back").onclick = () => advance(proc, "cadastro");

    document.getElementById("form-consulta").onsubmit = (e) => {
      e.preventDefault();
      if (!document.getElementById("autorizo").checked) return;
      proc.numeroCnj = document.getElementById("cnj").value;
      proc.advogadoTexto = document.getElementById("advogado").value;
      proc.autorizouConsulta = true;
      proc.autorizadoEm = new Date().toISOString();
      proc.analiseStatus = "processando";
      saveProcesso(proc);
      render(proc);
    };
  }

  function renderProcessando(target, proc) {
    target.innerHTML = `
      <h2>Analisando o seu processo</h2>
      <p class="muted">
        Nossa inteligência está lendo os andamentos do processo, identificando a fase atual,
        decisões já proferidas e calculando o valor base da causa.
      </p>
      <div class="spinner"></div>
      <div class="loading-text" id="loading-msg">Conectando ao DJEN/CNJ…</div>
    `;
    const msgs = [
      "Conectando ao DJEN/CNJ…",
      "Buscando andamentos no DataJud…",
      "Lendo decisões e despachos…",
      "Identificando a fase processual atual…",
      "Calculando o valor base da causa…",
      "Estimando a classe de risco…",
    ];
    const el = document.getElementById("loading-msg");
    let i = 0;
    const itv = setInterval(() => {
      i++;
      if (i < msgs.length) el.textContent = msgs[i];
    }, 900);

    setTimeout(() => {
      clearInterval(itv);
      // Gera análise + oferta (mock determinístico por id)
      const valorDeclarado = proc.valorEstimado || 10000;
      // valor base pode divergir do declarado em ±15% (placeholder de LLM)
      const seed = (proc.id || "").replace(/\D/g, "").slice(-3);
      const n = parseInt(seed || "500", 10);
      const desvio = ((n % 30) - 15) / 100;
      const valorBaseCausa = Math.round(valorDeclarado * (1 + desvio));

      const classe = (() => {
        const k = n % 100;
        if (k < 25) return "B";
        if (k < 60) return "C";
        if (k < 85) return "D";
        return "E";
      })();
      const desconto = { A: 0.10, B: 0.18, C: 0.28, D: 0.40, E: 0.55 }[classe];
      const valorAntecipadoIntegral = Math.round(valorBaseCausa * (1 - desconto));
      const parteCliente = Math.round(valorBaseCausa * (1 - HONORARIOS_PCT_PADRAO));
      const valorAntecipadoParcial = Math.round(parteCliente * (1 - desconto));

      proc.analise = {
        valorBaseCausa,
        fase: "Em fase de cumprimento de sentença",
        decisao: "Sentença favorável transitada em julgado",
        classe,
        confianca: 0.82,
      };
      proc.oferta = {
        valorOriginal: valorDeclarado,
        valorBaseCausa,
        valorAntecipadoIntegral,
        valorAntecipadoParcial,
        descontoPct: desconto,
        validadeDias: 7,
        geradaEm: new Date().toISOString(),
      };

      if (isAsyncAnalise(proc)) {
        proc.analiseStatus = "aguardando_async";
        saveProcesso(proc);
        render(proc);
      } else {
        proc.analiseStatus = "concluida";
        saveProcesso(proc);
        advance(proc, "oferta");
      }
    }, 4800);
  }

  function renderAguardandoAsync(target, proc) {
    target.innerHTML = `
      <h2>Análise mais detalhada em andamento</h2>
      <p class="muted">
        O seu processo precisa de uma análise um pouco mais cuidadosa. Tudo certo, isso é normal —
        nosso time vai concluir a análise e <strong>você será notificado(a) por e-mail</strong>
        assim que a proposta estiver pronta.
      </p>

      <div class="card mt-3">
        <h3>Próximos passos</h3>
        <ul style="font-size:.96rem;">
          <li>📩 Você recebe um e-mail em <strong>${Auth.currentUser().email}</strong> assim que a proposta sair (geralmente em até 24h úteis).</li>
          <li>📊 Você pode acompanhar o status no painel a qualquer momento.</li>
          <li>❓ Se preferir, fale com nosso time pelo <a href="../index.html#contato">canal de suporte</a>.</li>
        </ul>
      </div>

      <div class="alert mt-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div>Enquanto isso, seu processo está com status <strong>"Em análise"</strong> no seu painel.</div>
      </div>

      <div class="journey-actions">
        <a href="dashboard.html" class="btn btn--primary">Voltar ao painel</a>
        <button class="btn btn--ghost" id="btn-simular-pronto">[demo] Simular notificação recebida</button>
      </div>
    `;
    document.getElementById("btn-simular-pronto").onclick = () => {
      proc.analiseStatus = "concluida";
      saveProcesso(proc);
      advance(proc, "oferta");
    };
  }

  return { ESTAGIOS, TRIBUNAIS, render, loadProcesso, advance };
})();

window.Jornada = Jornada;
