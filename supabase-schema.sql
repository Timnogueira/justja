-- ============================================================================
-- Just Já — Schema do banco de dados (MVP)
-- ----------------------------------------------------------------------------
-- INSTRUÇÕES:
-- 1. Painel Supabase → Database → SQL Editor → "+ New query"
-- 2. Cola este arquivo inteiro
-- 3. Clica "Run" (canto inferior direito)
-- 4. Confere se apareceu "Success. No rows returned" — significa que rodou
--
-- O que isso cria:
-- - Tabela `processos` (todos os dados de cada antecipação)
-- - Trigger pra atualizar `updated_at` automaticamente
-- - Row Level Security: cada usuário só vê os próprios processos
-- ============================================================================

-- ----------------------------- Tabela ---------------------------------------
create table if not exists public.processos (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,

  -- Dados do cadastro
  titulo          text,
  tipo            text,                       -- aereo | consumidor | bancario | outras
  tribunal        text,
  numero_cnj      text,
  valor_estimado  numeric,
  descricao       text,
  cpf_titular     text,
  advogado_texto  text,

  -- Controle de fluxo
  estagio         text        not null default 'cadastro',
  status          text        not null default 'ativo',

  -- Dados gerados pela análise (mock por enquanto)
  estimativa      jsonb,
  analise         jsonb,
  oferta          jsonb,

  -- Decisões e eventos
  escolha_cessao         text,                 -- integral | parcial
  autorizou_consulta     boolean default false,
  autorizado_em          timestamptz,
  analise_status         text,                 -- form | processando | aguardando_async | concluida
  assinatura             jsonb,
  protocolacao           jsonb,
  pagamento_status       text default 'pendente',  -- pendente | no_carrinho | pago
  pagamento              jsonb,

  -- Trilha
  historico       jsonb       default '[]'::jsonb,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ----------------------------- Trigger updated_at ---------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists processos_touch_updated_at on public.processos;
create trigger processos_touch_updated_at
  before update on public.processos
  for each row execute function public.touch_updated_at();

-- ----------------------------- Índices --------------------------------------
create index if not exists processos_user_id_idx     on public.processos (user_id);
create index if not exists processos_estagio_idx     on public.processos (estagio);
create index if not exists processos_updated_at_idx  on public.processos (updated_at desc);

-- ----------------------------- Row Level Security ---------------------------
alter table public.processos enable row level security;

-- SELECT: só vê os próprios
drop policy if exists "Usuários veem seus próprios processos" on public.processos;
create policy "Usuários veem seus próprios processos"
  on public.processos for select
  using (auth.uid() = user_id);

-- INSERT: só pode criar processo pra si mesmo
drop policy if exists "Usuários criam processos para si" on public.processos;
create policy "Usuários criam processos para si"
  on public.processos for insert
  with check (auth.uid() = user_id);

-- UPDATE: só atualiza os próprios
drop policy if exists "Usuários atualizam seus processos" on public.processos;
create policy "Usuários atualizam seus processos"
  on public.processos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: só apaga os próprios
drop policy if exists "Usuários deletam seus processos" on public.processos;
create policy "Usuários deletam seus processos"
  on public.processos for delete
  using (auth.uid() = user_id);

-- ----------------------------- Validação ------------------------------------
-- Roda essas queries depois pra conferir que tá tudo certo:
--   select count(*) from public.processos;  -- deve dar 0
--   select * from pg_policies where tablename = 'processos';  -- deve listar 4 policies
