-- Credit RPCs are SECURITY DEFINER and do not check auth.uid().
-- PostgreSQL grants EXECUTE to PUBLIC by default, and this project never
-- revoked it, so the anon key could mint credits. Writes to profiles and
-- transcriptions go through the service role; the browser only selects.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'reserve_user_credits', 'reserve_anon_credits',
        'adjust_user_credits', 'adjust_anon_credits',
        'refund_user_credits', 'refund_anon_credits'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

revoke insert, update, delete on table public.profiles from public, anon, authenticated;
revoke insert, update, delete on table public.transcriptions from public, anon, authenticated;

-- If a write grant is added back, credit columns and the Gladia result URL
-- still cannot be changed by a signed-in user. The poll route fetches that
-- URL with the Gladia key.
create or replace function public.protect_profile_credits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.credits_seconds := old.credits_seconds;
    new.is_unlimited := old.is_unlimited;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_credits on public.profiles;
create trigger profiles_protect_credits
  before update on public.profiles
  for each row execute function public.protect_profile_credits();

create or replace function public.protect_transcription_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.gladia_result_url := null;
      new.reserved_seconds := null;
      new.result := null;
      new.status := 'error';
    else
      new.gladia_result_url := old.gladia_result_url;
      new.reserved_seconds := old.reserved_seconds;
      new.result := old.result;
      new.status := old.status;
      new.duration_seconds := old.duration_seconds;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists transcriptions_protect_fields on public.transcriptions;
create trigger transcriptions_protect_fields
  before insert or update on public.transcriptions
  for each row execute function public.protect_transcription_fields();

revoke all on function public.protect_profile_credits() from public, anon, authenticated;
revoke all on function public.protect_transcription_fields() from public, anon, authenticated;
