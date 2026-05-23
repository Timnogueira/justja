/* ==========================================================================
   Just Já — Widget de chat flutuante
   --------------------------------------------------------------------------
   Injeta um botão flutuante + painel de chat em qualquer página.
   Pronto para ligar numa IA conversacional (Claude / GPT / etc.) via API.

   Para plugar em produção:
   1. Substitua a função `callChatAPI(messages)` abaixo.
   2. Ela deve fazer fetch para o SEU backend proxy (NUNCA a API do Claude
      direto do browser — a chave ficaria exposta). Exemplos de proxy:
        - Cloudflare Worker (15 linhas, grátis)
        - Vercel/Next.js API route (/api/chat)
        - Supabase Edge Function
   3. O proxy recebe { messages: [...] } e devolve { reply: "texto" }.
   ========================================================================== */

(function () {
  const STORAGE_KEY = "justja.chat.history.v1";
  // Endpoint do Cloudflare Worker (proxy para a API do Claude).
  // Se quiser voltar para o modo canned, é só definir como null.
  const API_ENDPOINT = "https://justja-chat.timbere-nog.workers.dev";

  // ---------- Estado ----------
  function loadHistory() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveHistory(h) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  }

  // ---------- Markup ----------
  const html = `
    <button class="chat-fab" id="chat-fab" aria-label="Abrir chat">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="chat-fab__pulse"></span>
    </button>

    <div class="chat-panel" id="chat-panel" aria-hidden="true">
      <header class="chat-panel__header">
        <div class="chat-panel__title">
          <span class="chat-panel__avatar">JJ</span>
          <div>
            <div style="font-weight:700;">Just Já</div>
            <div style="font-size:.78rem; opacity:.7;">Resposta na hora · IA + time humano</div>
          </div>
        </div>
        <button class="chat-panel__close" id="chat-close" aria-label="Fechar">×</button>
      </header>

      <div class="chat-panel__body" id="chat-body"></div>

      <form class="chat-panel__form" id="chat-form">
        <input id="chat-input" placeholder="Digite a sua dúvida…" autocomplete="off" required>
        <button type="submit" class="chat-send" aria-label="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  `;

  // ---------- Inicialização ----------
  function init() {
    const mount = document.createElement("div");
    mount.id = "jj-chat-mount";
    mount.innerHTML = html;
    document.body.appendChild(mount);

    const fab    = document.getElementById("chat-fab");
    const panel  = document.getElementById("chat-panel");
    const close  = document.getElementById("chat-close");
    const form   = document.getElementById("chat-form");
    const input  = document.getElementById("chat-input");
    const body   = document.getElementById("chat-body");

    const messages = loadHistory();
    if (messages.length === 0) {
      messages.push({
        role: "assistant",
        text: "Oi! 👋 Sou o assistente da Just Já. Posso ajudar com dúvidas sobre antecipação de processos, como funciona o cadastro, valores e prazos. Em que posso te ajudar?",
      });
      saveHistory(messages);
    }
    renderMessages(body, messages);

    fab.addEventListener("click", () => togglePanel(true));
    close.addEventListener("click", () => togglePanel(false));

    function togglePanel(open) {
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", String(!open));
      if (open) {
        input.focus();
        body.scrollTop = body.scrollHeight;
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      messages.push({ role: "user", text });
      saveHistory(messages);
      renderMessages(body, messages);
      input.value = "";

      // mostra "..." digitando
      messages.push({ role: "assistant", text: "…", typing: true });
      renderMessages(body, messages);

      try {
        const reply = await callChatAPI(messages.filter(m => !m.typing));
        // remove o "digitando" e adiciona resposta real
        messages.pop();
        messages.push({ role: "assistant", text: reply });
      } catch (err) {
        messages.pop();
        messages.push({
          role: "assistant",
          text: "Tive um problema técnico aqui. Por favor, tente de novo daqui a pouco — ou deixe sua mensagem no formulário abaixo da página que a gente responde.",
        });
      }
      saveHistory(messages);
      renderMessages(body, messages);
    });
  }

  function renderMessages(body, messages) {
    body.innerHTML = messages.map(m => `
      <div class="chat-msg chat-msg--${m.role} ${m.typing ? "chat-msg--typing" : ""}">
        ${m.typing
          ? '<span class="chat-typing"><i></i><i></i><i></i></span>'
          : escapeHtml(m.text).replace(/\n/g, "<br>")}
      </div>
    `).join("");
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // ---------- API ----------
  // Em produção, esta função vira:
  //   const r = await fetch(API_ENDPOINT, {
  //     method: "POST", headers: { "content-type": "application/json" },
  //     body: JSON.stringify({ messages })
  //   });
  //   const data = await r.json();
  //   return data.reply;
  async function callChatAPI(messages) {
    if (API_ENDPOINT) {
      const r = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!r.ok) throw new Error("API error");
      const data = await r.json();
      return data.reply;
    }

    // Modo demo — respostas canned simples baseadas em palavras-chave
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    const last = (messages[messages.length - 1]?.text || "").toLowerCase();
    if (/(prazo|quanto tempo|demora)/.test(last)) {
      return "A análise inicial leva de poucos minutos a 24h úteis. Após a assinatura do contrato e o envio do comprovante de protocolação, o PIX cai em até 24 horas.";
    }
    if (/(valor|quanto|recebo|porcentagem|%)/.test(last)) {
      return "O valor exato depende do tipo do processo e da fase em que ele está. A melhor forma de saber é fazer uma simulação rápida aqui no site — leva 30 segundos e não precisa de cadastro.";
    }
    if (/(advogado|oab)/.test(last)) {
      return "Sim, todo processo tem advogado, e a cessão passa por ele(a). Parte do valor da causa em geral corresponde a honorários, então você decide junto com seu advogado se antecipa o valor integral ou só a sua parte.";
    }
    if (/(seguro|legal|legítimo|golpe|confia)/.test(last)) {
      return "A operação é uma cessão de crédito, amparada pelo Art. 286 do Código Civil. Você não fica devendo nada — vende o direito de receber e quem assume o risco da espera do tribunal somos nós.";
    }
    if (/(documento|cadastro|começar|iniciar)/.test(last)) {
      return "Para começar, é só clicar em 'Criar conta' no topo. Você vai precisar do CPF, e-mail e do número do processo (CNJ) — você encontra esse número na intimação ou com o seu advogado.";
    }
    if (/(oi|olá|ola|bom dia|boa tarde|boa noite)/.test(last)) {
      return "Oi! Em que posso te ajudar? Posso responder sobre prazos, valores, documentos, segurança da operação ou como cadastrar o seu processo.";
    }
    return "Hmm, deixa eu te conectar com um humano pra essa. Por enquanto, você pode usar o formulário de contato logo abaixo, ou criar a sua conta e iniciar uma simulação — assim a gente já vê o seu caso específico.";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
