/* ==========================================================================
   Just Já — Portão de senha (pré-lançamento)
   --------------------------------------------------------------------------
   AVISO: este é um portão CLIENT-SIDE. Quem souber abrir o DevTools consegue
   burlar. Serve só para evitar olhares casuais enquanto o site está em fase
   de validação privada com o time.

   Para tirar o portão: remova o <script src="assets/js/gate.js"></script>
   das páginas HTML.

   Para trocar a senha: edite a constante PASSWORD abaixo.
   ========================================================================== */

(function () {
  const PASSWORD   = "justja2026";                // ⚠️ TROQUE AQUI
  const UNLOCK_KEY = "justja.gate.unlocked.v1";

  // Se já desbloqueou nesta sessão, não faz nada.
  try {
    if (sessionStorage.getItem(UNLOCK_KEY) === "1") return;
  } catch (_) { /* sessionStorage pode estar bloqueado */ }

  // Injeta CSS imediatamente para esconder a página enquanto o overlay carrega
  const css = `
    body > *:not(#justja-gate) { display: none !important; }
    html, body { overflow: hidden !important; }
    #justja-gate {
      position: fixed; inset: 0;
      background: linear-gradient(135deg, #0a2a45 0%, #0f3d5e 60%, #14507a 100%);
      color: #fff; z-index: 999999;
      display: grid; place-items: center;
      font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    #justja-gate .box {
      background: #fff; color: #0f172a;
      padding: 40px 36px; border-radius: 22px;
      max-width: 400px; width: 100%;
      box-shadow: 0 30px 60px rgba(0,0,0,.35);
      text-align: center;
      box-sizing: border-box;
    }
    #justja-gate .logo {
      width: 56px; height: 56px; margin: 0 auto 16px;
      display: block;
    }
    #justja-gate h1 {
      margin: 4px 0 6px; font-size: 1.6rem; font-weight: 800;
      letter-spacing: -.02em; color: #0a2a45;
    }
    #justja-gate p {
      color: #64748b; font-size: .94rem; margin: 0 0 24px;
      line-height: 1.5;
    }
    #justja-gate form { display: flex; flex-direction: column; gap: 10px; }
    #justja-gate input {
      width: 100%; padding: 13px 16px; border-radius: 12px;
      border: 1.5px solid #e2e8f0; font-size: 1rem; box-sizing: border-box;
      font-family: inherit;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    #justja-gate input:focus {
      outline: none; border-color: #0f3d5e;
      box-shadow: 0 0 0 4px #e6f0f8;
    }
    #justja-gate button {
      width: 100%; padding: 14px; margin-top: 4px;
      background: #0f3d5e; color: #fff; border: 0; border-radius: 999px;
      font-weight: 600; font-size: 1rem; cursor: pointer;
      transition: background .15s ease;
    }
    #justja-gate button:hover { background: #14507a; }
    #justja-gate .err {
      color: #dc2626; font-size: .88rem; margin-top: 8px; min-height: 1.2em;
    }
    #justja-gate .foot {
      margin-top: 22px; font-size: .78rem; color: #94a3b8;
    }
  `;
  const style = document.createElement("style");
  style.id = "justja-gate-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  function inject() {
    const overlay = document.createElement("div");
    overlay.id = "justja-gate";
    overlay.innerHTML = `
      <div class="box">
        <svg class="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M16 2L4 8v9c0 6.6 5.4 12 12 13 6.6-1 12-6.4 12-13V8L16 2z" fill="#0f3d5e"/>
          <path d="M11 16l3.5 3.5L22 12" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <h1>Just Já</h1>
        <p>Versão pré-lançamento — acesso restrito.<br>Informe a senha para continuar.</p>
        <form>
          <input type="password" placeholder="Senha de acesso" autofocus required autocomplete="off">
          <button type="submit">Entrar</button>
          <div class="err"></div>
        </form>
        <div class="foot">Compartilhamento privado · não distribua a senha</div>
      </div>
    `;
    document.body.appendChild(overlay);
    const form  = overlay.querySelector("form");
    const input = overlay.querySelector("input");
    const err   = overlay.querySelector(".err");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (input.value === PASSWORD) {
        try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch (_) {}
        const s = document.getElementById("justja-gate-style");
        if (s) s.remove();
        overlay.remove();
        // dispara evento, caso algum script precise saber
        document.dispatchEvent(new CustomEvent("justja:unlocked"));
      } else {
        err.textContent = "Senha incorreta. Tente novamente.";
        input.select();
      }
    });
  }

  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
