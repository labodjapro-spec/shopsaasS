-- One browser/device = one push endpoint. Sending was previously multiplied
-- by leftover store-scoped rows (same PC, many endpoints).
DELETE FROM public.web_push_subscriptions a
USING public.web_push_subscriptions b
WHERE a.endpoint = b.endpoint
  AND a.ctid < b.ctid;

ALTER TABLE public.web_push_subscriptions
  DROP CONSTRAINT IF EXISTS web_push_subscriptions_store_id_user_id_endpoint_key;

ALTER TABLE public.web_push_subscriptions
  ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE public.web_push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_endpoint_uidx
  ON public.web_push_subscriptions (endpoint);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_user_device_uidx
  ON public.web_push_subscriptions (user_id, device_id)
  WHERE device_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_push_dispatches (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_push_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_push_dispatches FROM anon, authenticated;
GRANT ALL ON public.order_push_dispatches TO service_role;
