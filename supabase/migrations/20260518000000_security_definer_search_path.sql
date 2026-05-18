-- ============================================================
-- Fix SECURITY DEFINER functions without SET search_path.
-- Without it, an attacker with CREATE SCHEMA can shadow public
-- objects and redirect these functions to their own tables.
-- handle_new_user() already had this; align the rest.
-- ============================================================

ALTER FUNCTION reserve_user_credits(UUID, INT)  SET search_path = public;
ALTER FUNCTION reserve_anon_credits(TEXT, INT)  SET search_path = public;
ALTER FUNCTION adjust_user_credits(UUID, INT, INT) SET search_path = public;
ALTER FUNCTION adjust_anon_credits(TEXT, INT, INT) SET search_path = public;
ALTER FUNCTION refund_user_credits(UUID, INT)   SET search_path = public;
ALTER FUNCTION refund_anon_credits(TEXT, INT)   SET search_path = public;
