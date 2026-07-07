-- =============================================================================
-- JustJA — Migration inicial
-- Projeto Supabase: tdmfaifablgzdoymnvwb (mesmo projeto do Antecipa)
-- Executada em: 2026-07-06
-- =============================================================================

-- Tabela principal de casos / solicitações
-- Alimentada por duas fontes:
--   1. Formulário do site (origem = 'formulario_site', acesso anon)
--   2. Backoffice manual (origem = 'manual', acesso authenticated)

create table if not exists public.justja_casos (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  nome             text not null,
  telefone         text not null,
  email            text,
  tipo_processo    text,                          -- Direito Aéreo | Consumidor | Bancário | Outro
  numero_processo  text,                          -- formato CNJ: 0000000-00.0000.0.00.0000
  valor_estimado   text,                          -- valor livre (ex: "R$ 5.000,00")
  valor_proposta   text,                          -- valor da oferta da Just Já
  status           text not null default 'recebido'
                   check (status in (
                     'recebido',
                     'em_analise',
                     'proposta_enviada',
                     'aguardando_aceite',
                     'concluido'
                   )),
  origem           text not null default 'manual'
                   check (origem in ('formulario_site', 'manual')),
  observacao       text                           -- nota interna do backoffice
);

-- RLS
alter table public.justja_casos enable row level security;

-- Anônimo pode inserir (formulário do site usa anon key)
create policy justja_insert_anon
  on public.justja_casos for insert
  to anon, authenticated
  with check (true);

-- Apenas autenticados podem ler (backoffice usa Supabase Auth)
create policy justja_select_auth
  on public.justja_casos for select
  to authenticated
  using (true);

-- Apenas autenticados podem atualizar (backoffice)
create policy justja_update_auth
  on public.justja_casos for update
  to authenticated
  using (true);

-- Trigger updated_at (reaproveita função do projeto Antecipa se existir)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger justja_casos_updated_at
  before update on public.justja_casos
  for each row execute procedure public.handle_updated_at();
