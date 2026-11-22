-- Contacts WhatsApp par boutique (closers, livreurs, groupes)
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone       text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 20),
  role        text NOT NULL DEFAULT 'closer' CHECK (role IN ('closer', 'livreur', 'groupe')),
  template    text,          -- message pré-rempli personnalisé, NULL = template par défaut du rôle
  position    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_store_id_idx ON public.whatsapp_contacts(store_id, position);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Membres de la boutique peuvent lire les contacts
CREATE POLICY "store_members_select_whatsapp_contacts"
  ON public.whatsapp_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = whatsapp_contacts.store_id
        AND store_members.user_id = auth.uid()
    )
  );

-- Seuls les settings.write peuvent modifier
CREATE POLICY "settings_write_whatsapp_contacts"
  ON public.whatsapp_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      JOIN public.roles r ON r.id = sm.role_id
      WHERE sm.store_id = whatsapp_contacts.store_id
        AND sm.user_id = auth.uid()
        AND (
          r.permissions::jsonb @> '["*"]'::jsonb
          OR r.permissions::jsonb @> '["settings.write"]'::jsonb
        )
    )
  );
