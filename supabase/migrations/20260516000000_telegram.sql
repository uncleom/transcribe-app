-- ============================================================
-- 20260516000000_telegram.sql
-- Telegram bot: accounts linking + one-time link tokens
-- ============================================================

-- Maps Telegram user IDs to Supabase accounts
create table public.telegram_accounts (
  telegram_id        bigint primary key,
  supabase_user_id   uuid not null references auth.users(id) on delete cascade,
  telegram_username  text,
  created_at         timestamptz default now() not null
);

alter table public.telegram_accounts enable row level security;

-- All access via service_role only (admin client in API routes)
create policy "telegram_accounts: no direct access"
  on public.telegram_accounts for all using (false);

-- One-time tokens generated on the website for linking accounts
create table public.telegram_link_tokens (
  token              text primary key,
  supabase_user_id   uuid not null references auth.users(id) on delete cascade,
  expires_at         timestamptz not null,
  used               boolean default false not null,
  created_at         timestamptz default now() not null
);

alter table public.telegram_link_tokens enable row level security;

create policy "telegram_link_tokens: no direct access"
  on public.telegram_link_tokens for all using (false);

-- Clean up expired tokens automatically (optional, avoids table bloat)
create index telegram_link_tokens_expires_at_idx on public.telegram_link_tokens (expires_at);
