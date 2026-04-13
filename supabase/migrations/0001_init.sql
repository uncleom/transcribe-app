-- ============================================================
-- 0001_init.sql
-- Initial schema: profiles, transcriptions, storage bucket
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────
create type transcription_status as enum ('pending', 'processing', 'done', 'error');

-- ── Tables ───────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table public.transcriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  file_name          text not null,
  file_url           text not null,
  duration_seconds   numeric,
  language           text,
  status             transcription_status not null default 'pending',
  result             jsonb,
  gladia_result_url  text,
  created_at         timestamptz not null default now()
);

-- Index for common query: fetch all transcriptions for a user, newest first
create index transcriptions_user_id_created_at_idx
  on public.transcriptions (user_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.transcriptions  enable row level security;

-- profiles: each user can read and update only their own row
create policy "profiles: owner can select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: owner can update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles: service role inserts via trigger (no user-facing insert policy needed)

-- transcriptions: full CRUD for the owning user
create policy "transcriptions: owner can select"
  on public.transcriptions for select
  using (user_id = auth.uid());

create policy "transcriptions: owner can insert"
  on public.transcriptions for insert
  with check (user_id = auth.uid());

create policy "transcriptions: owner can update"
  on public.transcriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transcriptions: owner can delete"
  on public.transcriptions for delete
  using (user_id = auth.uid());

-- ── Auto-create profile on sign-up ───────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Storage ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('audio-files', 'audio-files', true)
on conflict (id) do nothing;

-- Service role uploads via API (bypasses RLS); no user-facing insert policy needed for MVP

-- Authenticated users can delete their own files (for future auth)
create policy "audio-files: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'audio-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public, but explicit policy for clarity)
create policy "audio-files: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'audio-files');
