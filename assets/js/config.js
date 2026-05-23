/* ==========================================================================
   Just Já — Configuração de ambiente
   --------------------------------------------------------------------------
   PREENCHA OS DOIS VALORES ABAIXO COM AS CREDENCIAIS DO SEU SUPABASE.

   Onde encontrar:
   1. Abra https://supabase.com → Login → seu projeto
   2. Menu lateral: Settings → API (ou "Project Settings → API")
   3. Copie:
        - "Project URL" → cole em SUPABASE_URL
        - Em "Project API keys": a "anon public" → cole em SUPABASE_ANON_KEY

   Por que é seguro deixar a anon key aqui:
   - Ela é PROJETADA pra rodar no browser.
   - Quem controla o que ela pode fazer é o RLS (Row Level Security) do Postgres.
   - Nunca cole a "service_role key" aqui (essa sim é secreta — só backend).
   ========================================================================== */

window.JUSTJA_CONFIG = {
  SUPABASE_URL:      "https://ypcocxqgjwsmjpqzhwgl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_AbM7j6QwxnI1frNsREjVtA_x1bTvBDk",
};
