-- =====================================================================
-- Étape 22 : Programmation des commandes avec date/heure et rappel Push
-- Ajoute scheduled_at et reminder_sent_at sur la table orders.
-- =====================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_scheduled_pending_idx
  ON public.orders (scheduled_at)
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;
