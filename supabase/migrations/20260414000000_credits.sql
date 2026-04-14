-- profiles: add credit fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credits_seconds INT NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT false;

-- transcriptions: track reserved seconds for post-completion adjustment
ALTER TABLE transcriptions
  ADD COLUMN IF NOT EXISTS reserved_seconds INT;

-- anonymous usage tracking
CREATE TABLE IF NOT EXISTS anonymous_usage (
  ip           TEXT PRIMARY KEY,
  used_seconds INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────
-- RPC: reserve credits (atomic check-and-decrement)
-- ───────────────────────────────────────────────

-- Auth user reservation
CREATE OR REPLACE FUNCTION reserve_user_credits(p_user_id UUID, p_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE updated_count INT;
BEGIN
  UPDATE profiles
  SET credits_seconds = credits_seconds - p_seconds
  WHERE id = p_user_id
    AND (is_unlimited = true OR credits_seconds >= p_seconds);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- Anonymous reservation (upsert with guard)
CREATE OR REPLACE FUNCTION reserve_anon_credits(p_ip TEXT, p_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE updated_count INT;
BEGIN
  INSERT INTO anonymous_usage (ip, used_seconds, updated_at)
  VALUES (p_ip, p_seconds, now())
  ON CONFLICT (ip) DO UPDATE
    SET used_seconds = anonymous_usage.used_seconds + p_seconds,
        updated_at   = now()
    WHERE anonymous_usage.used_seconds + p_seconds <= 180;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- ───────────────────────────────────────────────
-- RPC: adjust after completion (reserved vs actual)
-- ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION adjust_user_credits(p_user_id UUID, p_reserved INT, p_actual INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET credits_seconds = GREATEST(0, credits_seconds + p_reserved - p_actual)
  WHERE id = p_user_id AND is_unlimited = false;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_anon_credits(p_ip TEXT, p_reserved INT, p_actual INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE anonymous_usage
  SET used_seconds = GREATEST(0, LEAST(180, used_seconds - p_reserved + p_actual)),
      updated_at   = now()
  WHERE ip = p_ip;
END;
$$;

-- ───────────────────────────────────────────────
-- RPC: refund on error
-- ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refund_user_credits(p_user_id UUID, p_reserved INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET credits_seconds = credits_seconds + p_reserved
  WHERE id = p_user_id AND is_unlimited = false;
END;
$$;

CREATE OR REPLACE FUNCTION refund_anon_credits(p_ip TEXT, p_reserved INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE anonymous_usage
  SET used_seconds = GREATEST(0, used_seconds - p_reserved),
      updated_at   = now()
  WHERE ip = p_ip;
END;
$$;
