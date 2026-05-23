/* ==========================================================================
   Just Já — Auth via Supabase
   --------------------------------------------------------------------------
   Substitui a versão mock anterior. Usa @supabase/supabase-js (carregado por
   CDN no <head> de cada página) + as credenciais em config.js.

   API pública (compatível com a versão anterior):
     await Auth.signup({ nome, email, cpf, telefone, senha })
     await Auth.login({ email, senha })
     await Auth.logout()
     await Auth.init()              // carrega sessão atual (chamar 1x por página)
     Auth.currentUser()             // SÍNCRONO — depende de init() prévio
     await Auth.requireAuth(url)    // garante init + redireciona se não logado
     Auth.getSession()              // SÍNCRONO — sessão cacheada após init
     Auth.onChange(cb)              // hot updates de sessão
   ========================================================================== */

const Auth = (() => {
  let _client  = null;
  let _user    = null;
  let _session = null;
  let _initPromise = null;
  const _listeners = [];

  function client() {
    if (_client) return _client;
    const cfg = window.JUSTJA_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("COLE_")) {
      throw new Error("config.js não preenchido — defina SUPABASE_URL e SUPABASE_ANON_KEY.");
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("@supabase/supabase-js não carregado — inclua o <script> CDN no <head>.");
    }
    _client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    // ouvir mudanças de sessão (login em outra aba, refresh de token, etc.)
    _client.auth.onAuthStateChange((_event, session) => {
      _session = session || null;
      _user = session?.user ? toUser(session.user) : null;
      _listeners.forEach(cb => { try { cb(_user); } catch (_) {} });
    });
    return _client;
  }

  function toUser(u) {
    if (!u) return null;
    const m = u.user_metadata || {};
    return {
      id: u.id,
      email: u.email,
      nome: m.nome || (u.email || "").split("@")[0],
      cpf: m.cpf || null,
      telefone: m.telefone || null,
    };
  }

  // Inicializa a sessão (carrega do localStorage/cookie via SDK). Chamar 1x por página.
  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      const { data } = await client().auth.getSession();
      _session = data?.session || null;
      _user = _session?.user ? toUser(_session.user) : null;
      return _user;
    })();
    return _initPromise;
  }

  async function signup({ nome, email, cpf, telefone, senha, whatsappOptIn }) {
    email = (email || "").trim().toLowerCase();
    if (!email || !senha || !nome) throw new Error("Preencha nome, e-mail e senha.");
    if (senha.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres.");

    const { data, error } = await client().auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
          cpf: (cpf || "").replace(/\D/g, "") || null,
          telefone: (telefone || "").replace(/\D/g, "") || null,
          whatsapp_opt_in: !!whatsappOptIn,
          whatsapp_opt_in_at: whatsappOptIn ? new Date().toISOString() : null,
        },
      },
    });
    if (error) throw new Error(translateError(error.message));
    _session = data.session || null;
    _user = data.user ? toUser(data.user) : null;
    return {
      user: _user,
      needsEmailConfirmation: !data.session && !!data.user,
    };
  }

  async function login({ email, senha }) {
    email = (email || "").trim().toLowerCase();
    const { data, error } = await client().auth.signInWithPassword({
      email, password: senha,
    });
    if (error) throw new Error(translateError(error.message));
    _session = data.session || null;
    _user = data.user ? toUser(data.user) : null;
    return _user;
  }

  async function logout(redirectTo) {
    try { await client().auth.signOut(); } catch (_) {}
    _user = null; _session = null;
    if (redirectTo !== false) {
      window.location.href = redirectTo || "/login.html";
    }
  }

  function currentUser() { return _user; }
  function getSession()  { return _session; }

  async function requireAuth(redirectTo) {
    if (!_initPromise) await init();
    else await _initPromise;
    if (!_user) {
      window.location.href = redirectTo || "../login.html";
      return null;
    }
    return _user;
  }

  async function requireGuest(redirectTo) {
    if (!_initPromise) await init();
    else await _initPromise;
    if (_user) {
      window.location.href = redirectTo || "app/dashboard.html";
      return null;
    }
    return true;
  }

  function onChange(cb) { _listeners.push(cb); }

  // Traduz mensagens comuns para PT-BR
  function translateError(msg) {
    const map = {
      "Invalid login credentials": "E-mail ou senha incorretos.",
      "User already registered":   "Já existe uma conta com este e-mail.",
      "Email not confirmed":       "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.",
      "Password should be at least 6 characters.": "A senha deve ter ao menos 6 caracteres.",
      "email rate limit exceeded": "Muitas tentativas em pouco tempo. Aguarde alguns minutos ou peça ao admin para desligar a confirmação de e-mail no Supabase.",
      "Signups not allowed for this instance": "O cadastro está fechado. Peça ao admin para liberar em Authentication → Providers → Email.",
    };
    // tenta lowercase
    if (map[msg]) return map[msg];
    if (map[msg.toLowerCase()]) return map[msg.toLowerCase()];
    return msg;
  }

  return {
    init, signup, login, logout,
    currentUser, getSession, requireAuth, requireGuest, onChange,
    client,   // expõe o supabase client pra app.js/jornada.js usarem queries
  };
})();

window.Auth = Auth;
