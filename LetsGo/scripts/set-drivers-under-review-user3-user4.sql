-- Run in Supabase Dashboard → SQL Editor (runs as postgres).
-- Sets driver approval to under_review for the two test accounts.

UPDATE public.drivers d
SET approval_status = 'under_review'
FROM public.profiles p
WHERE p.id = d.id
  AND lower(trim(coalesce(p.email, ''))) IN ('user3@letsgoau.com', 'user4@letsgoau.com');

-- If the UPDATE affects 0 rows, emails may only live on auth.users — try this instead:
-- UPDATE public.drivers d
-- SET approval_status = 'under_review'
-- WHERE d.id IN (
--   SELECT id FROM auth.users
--   WHERE lower(trim(email::text)) IN ('user3@letsgoau.com', 'user4@letsgoau.com')
-- );

-- Verify
SELECT p.email, d.id, d.approval_status
FROM public.drivers d
JOIN public.profiles p ON p.id = d.id
WHERE lower(trim(coalesce(p.email, ''))) IN ('user3@letsgoau.com', 'user4@letsgoau.com');
