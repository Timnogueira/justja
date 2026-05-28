-- ============================================================================
-- Just Já — Backoffice: controle de acesso (admin / operador)
-- ----------------------------------------------------------------------------
-- Roda DEPOIS do supabase-schema.sql. Pode rodar várias vezes (idempotente).
--
-- INSTRUÇÕES:
--   1. SQL Editor → + New query → cola tudo → Run
--   2. No final, rode o UPDATE comentado pra te tornar admin (troque o e-mail)
-- ============================================================================

-- ---------- 1. Adiciona 'operador' ao enum de role -------------------------
alter table public.pessoas drop constraint if exists pessoas_role_check;
alter table public.pessoas add constraint pessoas_role_check
  check (role in ('cliente','advogado','admin','operador'));

-- ---------- 2. Notas internas (histórico com autor) ------------------------
alter table public.operacoes add column if not exists notas_internas jsonb default '[]'::jsonb;

-- ---------- 3. Função is_staff() -------------------------------------------
-- SECURITY DEFINER: roda com privilégio elevado, ignora RLS → evita recursão.
create or replace function public.is_staff() returns boolean as $$
  select exists (
    select 1 from public.pessoas
    where user_id = auth.uid() and role in ('admin','operador')
  );
$$ language sql stable security definer;

-- ---------- 4. Policies de staff (somam às policies de cliente) ------------
-- Postgres RLS é permissivo: se QUALQUER policy passar, o acesso é liberado.
-- Então essas policies dão à equipe acesso total SEM remover o acesso do cliente.

-- pessoas
drop policy if exists "Staff: select pessoas"  on public.pessoas;
drop policy if exists "Staff: update pessoas"  on public.pessoas;
create policy "Staff: select pessoas"  on public.pessoas  for select using (public.is_staff());
create policy "Staff: update pessoas"  on public.pessoas  for update using (public.is_staff()) with check (public.is_staff());

-- advogados
drop policy if exists "Staff: select advogados" on public.advogados;
create policy "Staff: select advogados" on public.advogados for select using (public.is_staff());

-- processos
drop policy if exists "Staff: select processos" on public.processos;
drop policy if exists "Staff: update processos" on public.processos;
create policy "Staff: select processos" on public.processos for select using (public.is_staff());
create policy "Staff: update processos" on public.processos for update using (public.is_staff()) with check (public.is_staff());

-- operacoes
drop policy if exists "Staff: select operacoes" on public.operacoes;
drop policy if exists "Staff: update operacoes" on public.operacoes;
create policy "Staff: select operacoes" on public.operacoes for select using (public.is_staff());
create policy "Staff: update operacoes" on public.operacoes for update using (public.is_staff()) with check (public.is_staff());

-- ofertas
drop policy if exists "Staff: select ofertas" on public.ofertas;
drop policy if exists "Staff: insert ofertas" on public.ofertas;
drop policy if exists "Staff: update ofertas" on public.ofertas;
create policy "Staff: select ofertas" on public.ofertas for select using (public.is_staff());
create policy "Staff: insert ofertas" on public.ofertas for insert with check (public.is_staff());
create policy "Staff: update ofertas" on public.ofertas for update using (public.is_staff()) with check (public.is_staff());

-- assinaturas
drop policy if exists "Staff: select assinaturas" on public.assinaturas;
create policy "Staff: select assinaturas" on public.assinaturas for select using (public.is_staff());

-- ============================================================================
-- 5. TE TORNAR ADMIN  →  troque o e-mail abaixo e rode esta linha:
-- ============================================================================
-- update public.pessoas set role = 'admin'
--   where user_id = (select id from auth.users where email = 'SEU_EMAIL_AQUI');

-- Pra criar um OPERADOR: cadastra a conta normalmente pelo site, depois:
-- update public.pessoas set role = 'operador'
--   where user_id = (select id from auth.users where email = 'EMAIL_DO_OPERADOR');

-- Conferir quem é staff:
-- select nome, email, role from public.pessoas where role in ('admin','operador');
