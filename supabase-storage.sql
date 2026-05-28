-- ============================================================================
-- Just Já — Storage para documentos (termo assinado + comprovante)
-- ----------------------------------------------------------------------------
-- Roda no SQL Editor depois do supabase-schema.sql. Idempotente.
-- ============================================================================

-- 1) Bucket privado de comprovantes
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- 2) Policies de Storage
-- Convenção de path: <user_id>/<operacao_id>/<arquivo>
-- Garante que cada usuário só acessa os próprios arquivos.

drop policy if exists "Upload comprovante próprio" on storage.objects;
create policy "Upload comprovante próprio"
  on storage.objects for insert
  with check (
    bucket_id = 'comprovantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Ler comprovante próprio" on storage.objects;
create policy "Ler comprovante próprio"
  on storage.objects for select
  using (
    bucket_id = 'comprovantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Atualizar comprovante próprio" on storage.objects;
create policy "Atualizar comprovante próprio"
  on storage.objects for update
  using (
    bucket_id = 'comprovantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Deletar comprovante próprio" on storage.objects;
create policy "Deletar comprovante próprio"
  on storage.objects for delete
  using (
    bucket_id = 'comprovantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3) (Opcional) Permitir que a equipe (admin/operador) leia todos os comprovantes.
--    Requer a função public.is_staff() criada no supabase-admin.sql.
drop policy if exists "Staff lê todos comprovantes" on storage.objects;
create policy "Staff lê todos comprovantes"
  on storage.objects for select
  using (bucket_id = 'comprovantes' and public.is_staff());
