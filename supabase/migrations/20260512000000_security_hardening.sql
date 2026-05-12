-- ============================================================
-- 20260512000000_security_hardening.sql
-- C1: private storage bucket
-- C2: RLS on anonymous_usage
-- ============================================================

-- C1: Make audio-files bucket private
update storage.buckets
set public = false
where id = 'audio-files';

-- Drop the public read policy that was allowing any URL access
drop policy if exists "audio-files: public read" on storage.objects;

-- C2: Block direct table access to anonymous_usage
-- All reads/writes go through SECURITY DEFINER RPC functions only
alter table public.anonymous_usage enable row level security;

create policy "anonymous_usage: no direct access"
  on public.anonymous_usage for all
  using (false);
