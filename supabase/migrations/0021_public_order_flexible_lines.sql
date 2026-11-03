-- Allow COD orders without a variant (title-only lines) and accept
-- African phone numbers written with spaces or country prefix.
CREATE OR REPLACE FUNCTION public.create_public_order(
  p_store_id uuid,
  p_market_id uuid,
  p_name text,
  p_phone text,
  p_city text,
  p_address text,
  p_note text,
  p_lines jsonb,
  p_subtotal numeric,
  p_shipping numeric,
  p_total numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_number text;
  v_line jsonb;
  v_variant uuid;
  v_quantity integer;
  v_stock integer;
  v_unit_price numeric;
  v_base_subtotal numeric := 0;
  v_verified_shipping numeric := 0;
  v_phone_digits text;
  v_address text;
  v_had_variant boolean := false;
BEGIN
  IF p_store_id IS NULL OR p_market_id IS NULL THEN
    RAISE EXCEPTION 'invalid_store_or_market';
  END IF;

  SELECT shipping_fee INTO v_verified_shipping
  FROM public.markets
  WHERE id = p_market_id AND store_id = p_store_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_market'; END IF;

  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_address := trim(coalesce(nullif(trim(coalesce(p_address, '')), ''), p_city, 'À confirmer'));
  IF length(trim(coalesce(p_name, ''))) < 2
     OR length(v_phone_digits) < 6
     OR length(v_address) < 2 THEN
    RAISE EXCEPTION 'invalid_customer';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 OR jsonb_array_length(p_lines) > 20 THEN
    RAISE EXCEPTION 'invalid_order_lines';
  END IF;

  FOR v_line IN SELECT element FROM jsonb_array_elements(p_lines) AS elements(element) LOOP
    BEGIN
      v_variant := nullif(v_line->>'variant_id', '')::uuid;
      v_quantity := greatest(1, least(99, coalesce((v_line->>'quantity')::integer, 1)));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_order_line';
    END;

    IF v_variant IS NULL THEN
      IF length(trim(coalesce(v_line->>'title', ''))) < 1 THEN
        RAISE EXCEPTION 'invalid_order_lines';
      END IF;
      CONTINUE;
    END IF;

    v_had_variant := true;
    SELECT stock INTO v_stock
    FROM public.variants
    WHERE id = v_variant AND store_id = p_store_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_variant'; END IF;

    SELECT price INTO v_unit_price
    FROM public.variant_prices
    WHERE variant_id = v_variant
      AND market_id = p_market_id
      AND store_id = p_store_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_variant_price'; END IF;

    v_base_subtotal := v_base_subtotal + (v_unit_price * v_quantity);
    IF v_stock IS NOT NULL AND v_stock < v_quantity THEN RAISE EXCEPTION 'out_of_stock'; END IF;
    IF v_stock IS NOT NULL THEN
      UPDATE public.variants SET stock = stock - v_quantity
      WHERE id = v_variant AND store_id = p_store_id;
    END IF;
  END LOOP;

  IF v_had_variant THEN
    IF coalesce(p_subtotal, 0) > v_base_subtotal
       OR coalesce(p_shipping, 0) > v_verified_shipping
       OR coalesce(p_total, 0) > v_base_subtotal + v_verified_shipping
       OR coalesce(p_total, 0) < coalesce(p_shipping, 0) THEN
      RAISE EXCEPTION 'invalid_order_total';
    END IF;
  END IF;

  v_number := 'CMD-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.orders(
    store_id, market_id, order_number, customer_name, customer_phone,
    customer_city, customer_address, note, lines, subtotal, shipping_fee, total
  )
  VALUES (
    p_store_id, p_market_id, v_number, trim(p_name), trim(p_phone),
    trim(coalesce(p_city, '')), v_address, nullif(trim(coalesce(p_note, '')), ''),
    p_lines, greatest(0, coalesce(p_subtotal, 0)), greatest(0, coalesce(p_shipping, 0)),
    greatest(0, coalesce(p_total, 0))
  )
  RETURNING id INTO v_id;

  INSERT INTO public.order_events(order_id, store_id, event_type)
  VALUES (v_id, p_store_id, 'created');
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(uuid, uuid, text, text, text, text, text, jsonb, numeric, numeric, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, uuid, text, text, text, text, text, jsonb, numeric, numeric, numeric)
  TO anon, authenticated;
