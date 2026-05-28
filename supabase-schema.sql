-- ============================================================================
-- Just Já — Schema v2 (normalizado)
-- ----------------------------------------------------------------------------
-- ⚠️ DESTRUTIVO: este script APAGA a tabela `processos` antiga (e dados).
--   Como o sistema ainda está em fase de validação, isso é aceitável.
--   Os arquivos no Storage `comprovantes` permanecem (sem efeito colateral).
--
-- INSTRUÇÕES:
--   1. Painel Supabase → SQL Editor → + New query → cola tudo → Run
--   2. Confirma "Success. No rows returned" no final
-- ============================================================================

-- ---------- LIMPEZA ---------------------------------------------------------
drop table if exists public.assinaturas   cascade;
drop table if exists public.ofertas       cascade;
drop table if exists public.operacoes     cascade;
drop table if exists public.advogados     cascade;
drop table if exists public.pessoas       cascade;
drop table if exists public.processos     cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.handle_new_user()  cascade;

-- ---------- HELPERS ---------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ---------- 1. pessoas (base unificada) ------------------------------------
create table public.pessoas (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid unique references auth.users(id) on delete cascade,  -- nullable (pessoa pode existir sem login)
  tipo_pessoa        text not null default 'PF' check (tipo_pessoa in ('PF','PJ')),
  role               text not null default 'cliente' check (role in ('cliente','advogado','admin')),
  nome               text not null,
  cpf_cnpj           text,
  email              text,
  telefone           text,
  whatsapp_opt_in    boolean default false,
  whatsapp_opt_in_at timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create unique index pessoas_cpf_cnpj_uq on public.pessoas (cpf_cnpj) where cpf_cnpj is not null;
create index pessoas_role_idx on public.pessoas (role);
create trigger pessoas_touch before update on public.pessoas
  for each row execute function public.touch_updated_at();

-- ---------- 2. advogados (extensão de pessoa) -----------------------------
create table public.advogados (
  pessoa_id    uuid primary key references public.pessoas(id) on delete cascade,
  oab_numero   text not null,
  oab_estado   text not null check (length(oab_estado) = 2),
  banca        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create unique index advogados_oab_uq on public.advogados (oab_numero, oab_estado);
create trigger advogados_touch before update on public.advogados
  for each row execute function public.touch_updated_at();

-- ---------- 3. processos (processo judicial) ------------------------------
create table public.processos (
  id              uuid primary key default gen_random_uuid(),
  numero_cnj      text,
  tipo            text,        -- aereo | consumidor | bancario | outras
  tribunal        text,
  valor_causa     numeric,
  dados_publicos  jsonb,       -- raw de consulta DJEN/DataJud (futuro)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index processos_cnj_uq on public.processos (numero_cnj) where numero_cnj is not null;
create trigger processos_touch before update on public.processos
  for each row execute function public.touch_updated_at();

-- ---------- 4. operacoes (a antecipação) ----------------------------------
create table public.operacoes (
  id                  uuid primary key default gen_random_uuid(),
  processo_id         uuid references public.processos(id) on delete cascade,

  -- quem iniciou
  solicitante_id      uuid not null references public.pessoas(id) on delete cascade,
  tipo_solicitante    text not null check (tipo_solicitante in ('cliente','advogado')),

  -- partes
  cliente_id          uuid references public.pessoas(id),   -- pode ser nulo se advogado anteciparia só seus honorários
  advogado_id         uuid references public.pessoas(id),   -- pode ser nulo na fase inicial (cliente informa só texto)

  -- escopo
  escopo              text not null default 'integral'
    check (escopo in ('integral','parte_cliente','so_honorarios')),

  -- estado
  estagio             text not null default 'cadastro',
  status              text not null default 'ativo'
    check (status in ('ativo','recusada','concluida','expirada')),

  -- dados de cadastro/análise
  apelido             text,
  descricao           text,
  valor_estimado      numeric,              -- valor a antecipar (causa total para cliente; honorários para advogado)
  anexo_processo      jsonb,                -- doc do processo anexado pelo cliente (quando informa por anexo)
  advogado_texto      text,                 -- nome do advogado quando ainda não é pessoa cadastrada
  cpf_titular         text,                 -- CPF do titular do processo (informado na etapa de análise)

  -- controle de análise
  analise_status      text,
  autorizou_consulta  boolean default false,
  autorizado_em       timestamptz,

  -- dados ricos (JSONB pra evitar pulverizar tabelas antes da hora)
  analise             jsonb,
  protocolacao        jsonb,
  pagamento           jsonb,
  pagamento_status    text default 'pendente'
    check (pagamento_status in ('pendente','no_carrinho','pago')),

  -- escolha após a oferta
  escolha_cessao      text check (escolha_cessao in ('integral','parcial','so_honorarios')),

  -- trilha
  historico           jsonb default '[]'::jsonb,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index operacoes_solicitante_idx on public.operacoes (solicitante_id);
create index operacoes_processo_idx    on public.operacoes (processo_id);
create index operacoes_estagio_idx     on public.operacoes (estagio);
create index operacoes_updated_at_idx  on public.operacoes (updated_at desc);
create trigger operacoes_touch before update on public.operacoes
  for each row execute function public.touch_updated_at();

-- ---------- 5. ofertas (1:N por operação) ---------------------------------
create table public.ofertas (
  id                uuid primary key default gen_random_uuid(),
  operacao_id       uuid not null references public.operacoes(id) on delete cascade,
  valor_base_causa  numeric not null,
  valor_antecipado  numeric not null,
  desconto_pct      numeric not null,
  validade_dias     int default 7,
  expires_at        timestamptz not null default (now() + interval '7 days'),
  status            text not null default 'ativa'
    check (status in ('ativa','aceita','expirada','recusada','superada')),
  escolha_cessao    text check (escolha_cessao in ('integral','parcial','so_honorarios')),
  memorial          jsonb,
  gerada_em         timestamptz default now(),
  aceita_em         timestamptz,
  superada_em       timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index ofertas_operacao_idx on public.ofertas (operacao_id);
create index ofertas_status_idx   on public.ofertas (status);
create trigger ofertas_touch before update on public.ofertas
  for each row execute function public.touch_updated_at();

-- ---------- 6. assinaturas (log imutável) ---------------------------------
create table public.assinaturas (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references public.operacoes(id) on delete cascade,
  oferta_id       uuid references public.ofertas(id),
  signatario_id   uuid references public.pessoas(id),
  role            text not null check (role in ('cedente','cessionaria','advogado_anuente')),
  nome_digitado   text,
  ip              text,
  hash            text,
  assinado_em     timestamptz default now()
);
create index assinaturas_operacao_idx on public.assinaturas (operacao_id);

-- ============================================================================
-- TRIGGER: cria pessoa automaticamente quando user faz signup
-- ============================================================================
create or replace function public.handle_new_user() returns trigger as $$
declare
  v_nome     text;
  v_telefone text;
  v_wa       boolean;
  v_role     text;
begin
  v_nome     := coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1));
  v_telefone := new.raw_user_meta_data ->> 'telefone';
  v_wa       := coalesce((new.raw_user_meta_data ->> 'whatsapp_opt_in')::boolean, false);
  v_role     := coalesce(new.raw_user_meta_data ->> 'role', 'cliente');

  insert into public.pessoas (user_id, nome, email, telefone, whatsapp_opt_in, whatsapp_opt_in_at, role)
  values (
    new.id,
    v_nome,
    new.email,
    v_telefone,
    v_wa,
    case when v_wa then now() else null end,
    v_role
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.pessoas     enable row level security;
alter table public.advogados   enable row level security;
alter table public.processos   enable row level security;
alter table public.operacoes   enable row level security;
alter table public.ofertas     enable row level security;
alter table public.assinaturas enable row level security;

-- Helper: qual a pessoa do user logado
create or replace function public.current_pessoa_id() returns uuid as $$
  select id from public.pessoas where user_id = auth.uid() limit 1;
$$ language sql stable;

-- ----- pessoas ----- (vê e edita só a própria)
create policy "Pessoa: select própria" on public.pessoas for select
  using (auth.uid() = user_id);
create policy "Pessoa: insert própria" on public.pessoas for insert
  with check (auth.uid() = user_id);
create policy "Pessoa: update própria" on public.pessoas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----- advogados ----- (vinculada à pessoa do user)
create policy "Advogado: select próprio" on public.advogados for select
  using (pessoa_id = public.current_pessoa_id());
create policy "Advogado: insert próprio" on public.advogados for insert
  with check (pessoa_id = public.current_pessoa_id());
create policy "Advogado: update próprio" on public.advogados for update
  using (pessoa_id = public.current_pessoa_id())
  with check (pessoa_id = public.current_pessoa_id());

-- ----- processos ----- (aberto a usuários autenticados — quem é dono é a operação)
create policy "Processo: read autenticado" on public.processos for select
  to authenticated using (true);
create policy "Processo: insert autenticado" on public.processos for insert
  to authenticated with check (true);
create policy "Processo: update autenticado" on public.processos for update
  to authenticated using (true) with check (true);

-- ----- operacoes ----- (solicitante, cliente OU advogado podem ver)
create policy "Operação: select própria" on public.operacoes for select
  using (
    solicitante_id = public.current_pessoa_id()
    or cliente_id   = public.current_pessoa_id()
    or advogado_id  = public.current_pessoa_id()
  );
create policy "Operação: insert pra si" on public.operacoes for insert
  with check (solicitante_id = public.current_pessoa_id());
create policy "Operação: update próprias" on public.operacoes for update
  using (solicitante_id = public.current_pessoa_id())
  with check (solicitante_id = public.current_pessoa_id());

-- ----- ofertas ----- (via operação)
create policy "Oferta: select via operação" on public.ofertas for select
  using (
    operacao_id in (
      select id from public.operacoes
      where solicitante_id = public.current_pessoa_id()
         or cliente_id     = public.current_pessoa_id()
         or advogado_id    = public.current_pessoa_id()
    )
  );
create policy "Oferta: insert via operação" on public.ofertas for insert
  with check (
    operacao_id in (
      select id from public.operacoes where solicitante_id = public.current_pessoa_id()
    )
  );
create policy "Oferta: update via operação" on public.ofertas for update
  using (
    operacao_id in (
      select id from public.operacoes where solicitante_id = public.current_pessoa_id()
    )
  );

-- ----- assinaturas ----- (insert via operação, select via operação)
create policy "Assinatura: select via operação" on public.assinaturas for select
  using (
    operacao_id in (
      select id from public.operacoes
      where solicitante_id = public.current_pessoa_id()
         or cliente_id     = public.current_pessoa_id()
         or advogado_id    = public.current_pessoa_id()
    )
  );
create policy "Assinatura: insert via operação" on public.assinaturas for insert
  with check (
    operacao_id in (
      select id from public.operacoes where solicitante_id = public.current_pessoa_id()
    )
  );

-- ============================================================================
-- FIM
-- ============================================================================
-- Pra validar depois:
--   select * from pg_tables where schemaname = 'public';
--   select count(*) from public.pessoas;
