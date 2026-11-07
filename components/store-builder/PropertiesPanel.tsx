'use client'

import { Trash2 } from 'lucide-react'
import TextField from './fields/TextField'
import TextareaField from './fields/TextareaField'
import ColorField from './fields/ColorField'
import ToggleField from './fields/ToggleField'
import SliderField from './fields/SliderField'
import SelectField from './fields/SelectField'
import ImageUploadField from './fields/ImageUploadField'
import ItemsListField, { FieldSchema } from './fields/ItemsListField'
import dynamic from 'next/dynamic'
import type { EditorBlock } from './Editor'
import { FORM_COLOR_PRESETS, buildDefaultBundles, ensureOrderFormSettings } from '@/lib/store-builder/form-presets'
import { TESTIMONIAL_ANIMATIONS } from '@/lib/store-builder/form-presets'

const RichTextEditor = dynamic(
  () => import('@/components/RichTextEditor').then(m => ({ default: m.RichTextEditor })),
  { ssr: false }
)

interface PropertiesPanelProps {
  block: EditorBlock | null
  onUpdateSettings: (blockId: string, settings: Record<string, any>) => void
  onDelete: (blockId: string) => void
  onClose?: () => void
  selectedProduct?: { price?: number | string; currency?: string; title?: string; description?: string } | null
  products?: any[]
}

export default function PropertiesPanel({ block, onUpdateSettings, onDelete, onClose, selectedProduct, products }: PropertiesPanelProps) {
  if (!block) {
    return (
      <div className="w-[300px] h-full bg-white border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center text-gray-400 flex-shrink-0">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </div>
        <p className="font-medium">Cliquez sur un élément pour le modifier</p>
      </div>
    )
  }

  const s = block.settings || {}
  const update = (key: string, value: any) => onUpdateSettings(block.id, { [key]: value })

  /** Padding section — ajouter en haut de chaque case */
  const PaddingFields = () => (
    <>
      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Espacements</h4>
      <SliderField label="Marge haute (px)" value={s.padding_top ?? 48} onChange={v => update('padding_top', v)} min={0} max={160} />
      <SliderField label="Marge basse (px)" value={s.padding_bottom ?? 48} onChange={v => update('padding_bottom', v)} min={0} max={160} />
    </>
  )

  const renderFields = () => {
    switch (block.type) {
      // Barre d'annonce — gère les DEUX noms (header utilise "AnnouncementBar", template utilise "announcement_bar")
      case 'AnnouncementBar':
      case 'announcement_bar':
        return (
          <>
            <TextField label="Texte de l'annonce" value={s.text} onChange={v => update('text', v)} />
            <SliderField label="Taille du texte (px)" value={s.font_size ?? 13} onChange={v => update('font_size', v)} min={10} max={24} />
            <SliderField label="Hauteur de la bannière (px)" value={s.bar_height ?? 42} onChange={v => update('bar_height', v)} min={24} max={80} />
            <SliderField label="Vitesse (s — grand = lent)" value={s.speed ?? 18} onChange={v => update('speed', v)} min={5} max={60} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <ToggleField label="Bouton fermer" value={s.show_close ?? s.close_button} onChange={v => update('show_close', v)} />
          </>
        )
      case 'Header':
      case 'header':
        return (
          <>
            <ImageUploadField label="Logo (image)" value={s.logo_image} onChange={v => update('logo_image', v)} />
            <TextField label="Nom / Logo texte" value={s.logo_text} onChange={v => update('logo_text', v)} />
            <SliderField label="Hauteur logo (px)" value={s.logo_height ?? 40} onChange={v => update('logo_height', v)} min={24} max={120} />
            <SliderField label="Hauteur du header (px)" value={s.header_height ?? 64} onChange={v => update('header_height', v)} min={40} max={160} />
            <SliderField label="Taille texte liens (px)" value={s.font_size ?? 14} onChange={v => update('font_size', v)} min={10} max={24} />
            <SelectField label="Position logo" value={s.logo_position || 'center'} options={['left', 'center', 'right']} onChange={v => update('logo_position', v)} />
            <ToggleField label="Afficher recherche" value={s.show_search} onChange={v => update('show_search', v)} />
            <ToggleField label="Afficher panier" value={s.show_cart} onChange={v => update('show_cart', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'Titre':
        return (
          <>
            <PaddingFields />
            <div className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-lg p-3 mb-4 leading-relaxed">
              Le titre affiché vient de la fiche produit si le champ ci-dessous est vide. Taille et style s&apos;appliquent immédiatement dans l&apos;aperçu.
            </div>
            <TextareaField
              label="Titre du produit"
              value={s.text ?? selectedProduct?.title ?? ''}
              onChange={v => update('text', v)}
            />
            <SliderField label="Taille police (px)" value={s.font_size ?? 28} onChange={v => update('font_size', v)} min={16} max={64} />
            <SliderField label="Épaisseur (400=fin, 900=gras)" value={s.font_weight ?? 800} onChange={v => update('font_weight', v)} min={400} max={900} step={100} />
            <SelectField label="Alignement" value={s.text_align || 'left'} options={['left', 'center', 'right']} onChange={v => update('text_align', v)} />
            <ColorField label="Couleur" value={s.color} onChange={v => update('color', v)} />
          </>
        )
      case 'Note de produit':
        return (
          <>
            <PaddingFields />
            <SliderField label="Note" value={s.rating ?? 5} onChange={v => update('rating', v)} min={1} max={5} />
            <TextField label="Nombre d'avis (ex: 128 avis)" value={s.reviews_count} onChange={v => update('reviews_count', v)} />
            <ColorField label="Couleur étoiles" value={s.star_color} onChange={v => update('star_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <ToggleField label="Afficher" value={s.show !== false} onChange={v => update('show', v)} />
          </>
        )
      case 'Prix':
        return (
          <>
            <PaddingFields />
            <TextField label="Prix principal (ex: 15000 FCFA)" value={s.price} onChange={v => update('price', v)} />
            <SliderField label="Taille prix principal (px)" value={s.price_font_size ?? 28} onChange={v => update('price_font_size', v)} min={16} max={56} />
            <TextField label="Prix barré (ex: 30000 FCFA)" value={s.compare_at_price} onChange={v => update('compare_at_price', v)} />
            <ColorField label="Couleur prix" value={s.price_color} onChange={v => update('price_color', v)} />
            <ColorField label="Couleur prix barré" value={s.compare_color} onChange={v => update('compare_color', v)} />
            <ToggleField label="Afficher badge promo" value={s.show_badge !== false} onChange={v => update('show_badge', v)} />
            <TextField label="Texte badge (ex: -50%)" value={s.badge_text} onChange={v => update('badge_text', v)} />
            <ColorField label="Couleur fond badge" value={s.badge_bg} onChange={v => update('badge_bg', v)} />
            <ColorField label="Couleur texte badge" value={s.badge_text_color} onChange={v => update('badge_text_color', v)} />
          </>
        )
      case "Boutons d'achat":
        return (
          <>
            <PaddingFields />
            <TextField label="Texte bouton principal" value={s.btn_main_text} onChange={v => update('btn_main_text', v)} />
            <ColorField label="Couleur bouton principal" value={s.btn_main_color} onChange={v => update('btn_main_color', v)} />
            <ToggleField label="Afficher bouton secondaire" value={s.show_btn_sub} onChange={v => update('show_btn_sub', v)} />
            <TextField label="Texte bouton secondaire" value={s.btn_sub_text} onChange={v => update('btn_sub_text', v)} />
            <ColorField label="Couleur fond bouton secondaire" value={s.btn_sub_bg} onChange={v => update('btn_sub_bg', v)} />
            <ColorField label="Couleur texte bouton secondaire" value={s.btn_sub_color} onChange={v => update('btn_sub_color', v)} />
          </>
        )
      case 'Description':
        return (
          <>
            <PaddingFields />
            <div className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-lg p-3 mb-4 leading-relaxed">
              La fiche produit est la source principale. Titres H1/H2, gras et alignements sont identiques sur la boutique. La barre d&apos;outils reste visible en défilant.
            </div>
            <SelectField label="Alignement global" value={s.text_align || 'left'} options={['left', 'center', 'right']} onChange={v => update('text_align', v)} />
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description (fiche produit)</label>
              <RichTextEditor
                value={selectedProduct?.description || s.content || ''}
                onChange={(v: string) => update('content', v)}
                storeId="editor"
                folder="description"
              />
              <p className="text-[10px] text-gray-400 mt-2">Pour une synchro parfaite, enregistrez aussi depuis la fiche produit.</p>
            </div>
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'product':
      case 'Product':
        return (
          <>
            <PaddingFields />
            <div className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg p-3 mb-4">
              Ce bloc est un ancien format. Utilise plutôt les blocs séparés (Titre, Prix, Description...) pour plus de contrôle.
            </div>
            <ToggleField label="Afficher prix" value={s.show_price !== false} onChange={v => update('show_price', v)} />
            <ToggleField label="Afficher description" value={s.show_description !== false} onChange={v => update('show_description', v)} />
            <ToggleField label="Afficher avis" value={s.show_reviews_count !== false} onChange={v => update('show_reviews_count', v)} />
            <TextField label="Texte urgence" value={s.urgency_text} onChange={v => update('urgency_text', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
          </>
        )
      case 'Countdown':
      case 'countdown':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <SliderField label="Durée — heures" value={s.duration_hours ?? 2} onChange={v => update('duration_hours', v)} min={0} max={48} />
            <SliderField label="Durée — minutes" value={s.duration_minutes ?? 0} onChange={v => update('duration_minutes', v)} min={0} max={59} />
            <p className="text-[10px] text-gray-400 mb-3">Pas de calendrier : le compte à rebours repart à chaque visite selon la durée définie.</p>
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <ColorField label="Couleur chiffres" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <SelectField label="À expiration" value={s.on_expire || 'reset'} options={['reset', 'hide', 'message']} onChange={v => update('on_expire', v)} />
            <TextField label="Message d'expiration" value={s.expire_message} onChange={v => update('expire_message', v)} />
          </>
        )
      case 'reel_media':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre section" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur accent" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <ColorField label="Couleur titre" value={s.title_color} onChange={v => update('title_color', v)} />
            <ToggleField label="Lecture automatique" value={s.auto_play !== false} onChange={v => update('auto_play', v)} />
            <SliderField label="Vitesse défilement" value={s.speed ?? 40} onChange={v => update('speed', v)} min={10} max={100} />
            <ToggleField label="Afficher compteur" value={s.show_counter !== false} onChange={v => update('show_counter', v)} />
            <ItemsListField
              label="Médias" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'type', label: 'Type (image/video/gif)' },
                { type: 'image', id: 'url', label: 'URL fichier' },
                { type: 'text', id: 'caption', label: 'Légende' },
                { type: 'text', id: 'author', label: 'Nom auteur' },
              ]}
            />
          </>
        )
      case 'Benefits':
      case 'benefits':
      case 'icon_grid':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur icônes" value={s.icon_color} onChange={v => update('icon_color', v)} />
            
            <h4 className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">Bouton Action</h4>
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
            <ItemsListField
              label="Avantages" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'icon', label: 'Icône (emoji)' },
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'text', id: 'text', label: 'Texte' },
                { type: 'text', id: 'description', label: 'Description' }
              ]}
            />
          </>
        )
      case 'before_after':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <ImageUploadField label="Image Avant" value={s.before_image} onChange={v => update('before_image', v)} />
            <ImageUploadField label="Image Après" value={s.after_image} onChange={v => update('after_image', v)} />
            <TextField label="Label Avant" value={s.before_label} onChange={v => update('before_label', v)} />
            <TextField label="Label Après" value={s.after_label} onChange={v => update('after_label', v)} />
            <h4 className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">Bouton Action</h4>
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
          </>
        )
      case 'comparison':
      case 'comparison_table':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Nom colonne Nous" value={s.our_label || s.us_name} onChange={v => update('our_label', v)} />
            <TextField label="Nom colonne Concurrent" value={s.competitor_label || s.them_name} onChange={v => update('competitor_label', v)} />
            <ItemsListField
              label="Lignes" value={s.rows} onChange={v => update('rows', v)}
              itemSchema={[
                { type: 'text', id: 'feature', label: 'Fonctionnalité' },
                { type: 'toggle', id: 'us', label: 'Nous ✓' },
                { type: 'toggle', id: 'them', label: 'Concurrent ✓' }
              ]}
            />
          </>
        )
      case 'stats':
        return (
          <>
            <PaddingFields />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ItemsListField
              label="Stats" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'icon', label: 'Icône emoji' },
                { type: 'text', id: 'number', label: 'Chiffre' },
                { type: 'text', id: 'suffix', label: 'Suffixe (%, +, k...)' },
                { type: 'text', id: 'label', label: 'Label' }
              ]}
            />
          </>
        )
      case 'Faq':
      case 'faq':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            
            <h4 className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">Bouton Action</h4>
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
            <ItemsListField
              label="Questions" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'question', label: 'Question' },
                { type: 'textarea', id: 'answer', label: 'Réponse' }
              ]}
            />
          </>
        )
      case 'guarantees':
        return (
          <>
            <PaddingFields />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            
            <h4 className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">Bouton Action</h4>
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
            <ItemsListField
              label="Garanties" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'icon', label: 'Icône emoji' },
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'text', id: 'text', label: 'Texte' }
              ]}
            />
          </>
        )
      case 'marquee':
        return (
          <>
            <PaddingFields />
            <TextField label="Texte" value={s.text} onChange={v => update('text', v)} />
            <SliderField label="Vitesse (s — grand = lent)" value={s.speed ?? 20} onChange={v => update('speed', v)} min={5} max={60} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'ImageWithText':
      case 'image_text':
      case 'image_with_text':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextareaField label="Texte" value={s.text} onChange={v => update('text', v)} />
            <ImageUploadField label="Image" value={s.image_url} onChange={v => update('image_url', v)} />
            <SelectField label="Position image" value={s.image_position || 'left'} options={['left', 'right']} onChange={v => update('image_position', v)} />
            <SliderField label="Arrondi image (px)" value={s.image_radius ?? 16} onChange={v => update('image_radius', v)} min={0} max={32} />
            <ColorField label="Couleur fond section" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur titre" value={s.title_color} onChange={v => update('title_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'Video':
      case 'video':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="URL YouTube ou MP4" value={s.url} onChange={v => update('url', v)} />
            <ImageUploadField label="Image poster" value={s.poster_url || s.poster_image} onChange={v => update('poster_url', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
          </>
        )
      case 'text_block':
        return (
          <>
            <PaddingFields />
            <TextareaField label="Contenu" value={s.content} onChange={v => update('content', v)} rows={6} />
            <SelectField label="Alignement" value={s.text_align || 'center'} options={['left', 'center', 'right']} onChange={v => update('text_align', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'hotspots':
        return (
          <>
            <PaddingFields />
            <ImageUploadField label="Image principale" value={s.image_url} onChange={v => update('image_url', v)} />
            <ItemsListField
              label="Points interactifs" value={s.hotspots || []} onChange={v => update('hotspots', v)}
              itemSchema={[
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'textarea', id: 'description', label: 'Description' },
                { type: 'text', id: 'x', label: 'Position X (%) ex: 45' },
                { type: 'text', id: 'y', label: 'Position Y (%) ex: 60' }
              ]}
            />
          </>
        )
      case 'parallax':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <TextField label="Texte bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ImageUploadField label="Image de fond" value={s.bg_image} onChange={v => update('bg_image', v)} />
            <ImageUploadField label="Image de premier plan (optionnel)" value={s.fg_image} onChange={v => update('fg_image', v)} />
            <SliderField label="Opacité overlay noir (%)" value={s.overlay_opacity ?? 40} onChange={v => update('overlay_opacity', v)} min={0} max={90} />
          </>
        )
      case 'order_form':
      case 'OrderForm': {
        const unitPrice = selectedProduct?.price ? Number(selectedProduct.price) : 15000
        const currency = selectedProduct?.currency || 'FCFA'
        const bundleDefaults = buildDefaultBundles(unitPrice, currency)
        const displayBundles = s.bundles?.length ? s.bundles : bundleDefaults

        return (
          <>
            <PaddingFields />
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Palette rapide</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {FORM_COLOR_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  title={preset.name}
                  onClick={() => onUpdateSettings(block!.id, {
                    ...s,
                    bg_color: preset.bg_color,
                    border_color: preset.border_color,
                    title_color: preset.title_color,
                    subtitle_color: preset.subtitle_color,
                    label_color: preset.label_color,
                    btn_color: preset.btn_color,
                    input_bg: preset.input_bg,
                    input_border: preset.input_border,
                    bundle_selected_bg: preset.bundle_selected_bg,
                    bundle_selected_border: preset.bundle_selected_border,
                    bundle_bg: preset.bundle_bg,
                    bundle_border: preset.bundle_border,
                    bundle_badge_bg: preset.bundle_badge_bg,
                    bundle_badge_text: preset.bundle_badge_text,
                  })}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors"
                >
                  <span className="w-7 h-7 rounded-full border-2 border-white shadow" style={{ background: preset.btn_color }} />
                  <span className="text-[9px] text-gray-500">{preset.name}</span>
                </button>
              ))}
            </div>

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-2">Textes</h4>
            <TextField label="Titre (en-tête)" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <TextField label="Texte bouton" value={s.btn_text} onChange={v => update('btn_text', v)} />
            <TextField label="Texte pied de formulaire" value={s.footer_text} onChange={v => update('footer_text', v)} />
            <SliderField label="Taille titre (px)" value={s.title_size ?? 18} onChange={v => update('title_size', v)} min={14} max={32} />

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Style & bordures</h4>
            <SliderField label="Largeur max formulaire (0 = pleine largeur)" value={s.form_max_width ?? 0} onChange={v => update('form_max_width', v)} min={0} max={800} step={10} />
            <SliderField label="Hauteur en-tête coloré (px)" value={s.header_padding_y ?? 16} onChange={v => update('header_padding_y', v)} min={8} max={80} />
            <SliderField label="Taille titre en-tête (px)" value={s.title_font_size ?? 18} onChange={v => update('title_font_size', v)} min={12} max={36} />
            <SelectField label="Style du formulaire" value={s.form_style || 'classic'} options={['classic', 'modern', 'minimal', 'glowing', 'outlined']} onChange={v => update('form_style', v)} />
            <SelectField label="Style bordure" value={s.border_style || 'solid'} options={['solid', 'dashed', 'dotted', 'double']} onChange={v => update('border_style', v)} />
            <SliderField label="Épaisseur bordure (px)" value={s.border_width ?? 1} onChange={v => update('border_width', v)} min={0} max={6} />
            <SliderField label="Arrondi bordure (px)" value={s.border_radius ?? 16} onChange={v => update('border_radius', v)} min={0} max={32} />
            <SliderField label="Arrondi bouton (px)" value={s.btn_radius ?? 16} onChange={v => update('btn_radius', v)} min={0} max={32} />
            <SelectField label="Animation bouton" value={s.btn_animation || 'pulse'} options={['shake', 'pulse', 'bounce', 'glow', 'none']} onChange={v => update('btn_animation', v)} />

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Couleurs formulaire</h4>
            <ColorField label="Fond carte" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur bordure" value={s.border_color} onChange={v => update('border_color', v)} />
            <ColorField label="Couleur titre" value={s.title_color} onChange={v => update('title_color', v)} />
            <ColorField label="Couleur sous-titre" value={s.subtitle_color} onChange={v => update('subtitle_color', v)} />
            <ColorField label="Couleur labels" value={s.label_color} onChange={v => update('label_color', v)} />
            <ColorField label="Couleur bouton" value={s.btn_color} onChange={v => update('btn_color', v)} />
            <ColorField label="Fond inputs" value={s.input_bg} onChange={v => update('input_bg', v)} />
            <ColorField label="Bordure inputs" value={s.input_border} onChange={v => update('input_border', v)} />

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Bundles (offres quantité)</h4>
            <ToggleField label="Masquer les bundles" value={s.bundles_enabled === false} onChange={v => update('bundles_enabled', !v)} />
            <p className="text-[10px] text-gray-400 mb-2 -mt-2">
              3 offres pré-remplies par défaut. Supprime, modifie ou masque celles que tu veux — le formulaire reste seul si tout est masqué.
            </p>
            {!s.bundles?.length && (
              <button
                type="button"
                onClick={() => onUpdateSettings(block!.id, ensureOrderFormSettings(s, unitPrice, currency))}
                className="w-full mb-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
              >
                Charger les 3 offres template
              </button>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Style affichage</label>
              <select
                value={s.bundle_layout || 'deals'}
                onChange={e => update('bundle_layout', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="deals">Cartes premium (type Releasit)</option>
                <option value="columns">Colonnes quantité</option>
                <option value="list">Liste compacte</option>
              </select>
            </div>

            <SelectField label="Bordure bundle" value={s.bundle_border_style || 'solid'} options={['solid', 'dashed', 'dotted', 'double']} onChange={v => update('bundle_border_style', v)} />
            <SliderField label="Épaisseur bordure bundle" value={s.bundle_border_width ?? 1} onChange={v => update('bundle_border_width', v)} min={1} max={6} />
            <SliderField label="Épaisseur bordure sélectionnée" value={s.bundle_selected_border_width ?? 2} onChange={v => update('bundle_selected_border_width', v)} min={1} max={6} />
            <SliderField label="Arrondi bundle (px)" value={s.bundle_border_radius ?? 12} onChange={v => update('bundle_border_radius', v)} min={0} max={24} />
            <ColorField label="Fond offre sélectionnée" value={s.bundle_selected_bg} onChange={v => update('bundle_selected_bg', v)} />
            <ColorField label="Bordure offre sélectionnée" value={s.bundle_selected_border} onChange={v => update('bundle_selected_border', v)} />
            <ColorField label="Fond offre non sélectionnée" value={s.bundle_bg} onChange={v => update('bundle_bg', v)} />
            <ColorField label="Bordure offre" value={s.bundle_border} onChange={v => update('bundle_border', v)} />
            <ColorField label="Badge promo — fond" value={s.bundle_badge_bg} onChange={v => update('bundle_badge_bg', v)} />
            <ColorField label="Badge promo — texte" value={s.bundle_badge_text} onChange={v => update('bundle_badge_text', v)} />
            <ItemsListField
              label="Offres quantité"
              value={displayBundles}
              onChange={v => update('bundles', v)}
              itemSchema={[
                { type: 'toggle', id: 'hidden', label: 'Masquer cette offre' },
                { type: 'text', id: 'label', label: 'Titre (ex: 2 articles)' },
                { type: 'text', id: 'sublabel', label: 'Sous-texte promo' },
                { type: 'text', id: 'badge', label: 'Badge (ex: POPULAIRE)' },
                { type: 'text', id: 'free_gift', label: 'Cadeau offert (texte)' },
                { type: 'slider', id: 'qty', label: 'Quantité', min: 1, max: 10 },
                { type: 'slider', id: 'discount_pct', label: 'Réduction %', min: 0, max: 50 },
                { type: 'text', id: 'discount_fixed', label: 'OU réduction fixe (FCFA)' },
                { type: 'image', id: 'image', label: 'Image produit (optionnel)' },
                { type: 'toggle', id: 'popular', label: 'Sélectionné par défaut' },
              ] as FieldSchema[]}
            />

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Champs du formulaire</h4>
            <ToggleField label="Afficher champ Nom" value={s.show_name !== false} onChange={v => update('show_name', v)} />
            <ToggleField label="Afficher champ Téléphone" value={s.show_phone !== false} onChange={v => update('show_phone', v)} />
            <ToggleField label="Afficher champ Ville" value={s.show_city !== false} onChange={v => update('show_city', v)} />
            <ToggleField label="Afficher champ Email" value={!!s.show_email} onChange={v => update('show_email', v)} />

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Commande via WhatsApp</h4>
            <ToggleField label="Rediriger vers WhatsApp au clic" value={!!s.enable_whatsapp_order} onChange={v => update('enable_whatsapp_order', v)} />
            {s.enable_whatsapp_order && (
              <>
                <TextField label="Numéro WhatsApp" value={s.whatsapp_order_number} onChange={v => update('whatsapp_order_number', v)} />
                <TextareaField label="Message pré-rempli" value={s.whatsapp_order_msg} onChange={v => update('whatsapp_order_msg', v)} />
              </>
            )}

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Popup de confirmation</h4>
            <ToggleField label="Bouton WhatsApp dans le popup" value={s.show_popup_whatsapp !== false} onChange={v => update('show_popup_whatsapp', v)} />
            {s.show_popup_whatsapp !== false && (
              <>
                <TextareaField label="Message WhatsApp popup" value={s.popup_whatsapp_msg} onChange={v => update('popup_whatsapp_msg', v)} />
              </>
            )}

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 mt-4">Variantes / Options produit</h4>
            <p className="text-[10px] text-gray-400 mb-2 -mt-2">
              Ajoute des sélecteurs de variantes (taille, couleur, parfum…). Les choix seront envoyés avec la commande.
            </p>
            <VariantOptionsEditor value={s.variant_options || []} onChange={v => update('variant_options', v)} />
          </>
        )
      }
      case 'popup':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextareaField label="Texte" value={s.text} onChange={v => update('text', v)} />
            <TextField label="Texte bouton" value={s.btn_text} onChange={v => update('btn_text', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur bouton" value={s.btn_color} onChange={v => update('btn_color', v)} />
            <SliderField label="Délai apparition (sec)" value={s.delay ?? 2} onChange={v => update('delay', v)} min={0} max={60} />
          </>
        )
      case 'countdown_top_bar':
        return (
          <>
            <TextField label="Label (ex: Offre)" value={s.label} onChange={v => update('label', v)} />
            <TextField label="Texte réduction (ex: -50%)" value={s.discount_text} onChange={v => update('discount_text', v)} />
            <TextField label="Suffixe (ex: se termine dans)" value={s.suffix} onChange={v => update('suffix', v)} />
            <SliderField label="Durée — heures" value={s.duration_hours ?? 12} onChange={v => update('duration_hours', v)} min={0} max={48} />
            <SliderField label="Durée — minutes" value={s.duration_minutes ?? 0} onChange={v => update('duration_minutes', v)} min={0} max={59} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <ColorField label="Couleur accent (réduction)" value={s.accent_color} onChange={v => update('accent_color', v)} />
          </>
        )
      case 'Galerie':
      case 'medias':
      case 'gallery':
        return (
          <div className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-4 leading-relaxed">
            🖼️ La galerie affiche automatiquement les images du produit sélectionné.
            <br /><br />
            Pour la modifier, changez les images depuis la fiche produit. Vous pouvez glisser cette section où vous voulez dans la page.
          </div>
        )
      case 'spacer':
        return (
          <>
            <SliderField label="Hauteur (px)" value={s.height} onChange={v => update('height', v)} min={8} max={200} />
          </>
        )
      case 'Footer':
      case 'footer':
        return (
          <>
            <TextField label="Texte copyright" value={s.copyright} onChange={v => update('copyright', v)} />
            <TextField label="Numéro WhatsApp" value={s.whatsapp_number} onChange={v => update('whatsapp_number', v)} />
            <ToggleField label="Bouton WhatsApp flottant" value={s.show_whatsapp !== false} onChange={v => update('show_whatsapp', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'Testimonials':
      case 'testimonials_floating':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre section" value={s.title} onChange={v => update('title', v)} />
            <SelectField label="Animation" value={s.animation || 'float'} options={TESTIMONIAL_ANIMATIONS.map(a => a.id)} onChange={v => update('animation', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur titre" value={s.title_color} onChange={v => update('title_color', v)} />
            <ColorField label="Couleur accent (étoiles / badge)" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <ColorField label="Couleur ombre" value={s.shadow_color} onChange={v => update('shadow_color', v)} />
            <ItemsListField
              label="Témoignages"
              value={s.items}
              onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'name', label: 'Nom' },
                { type: 'text', id: 'location', label: 'Ville / Pays' },
                { type: 'textarea', id: 'text', label: 'Avis' },
                { type: 'slider', id: 'rating', label: 'Note', min: 1, max: 5 },
                { type: 'image', id: 'image', label: 'Photo de profil' },
                { type: 'image', id: 'product_image', label: 'Photo du produit reçu' },
                { type: 'toggle', id: 'verified', label: 'Achat vérifié' },
              ] as FieldSchema[]}
            />
          </>
        )
      case 'trust_bar':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher la note" value={s.show_score !== false} onChange={v => update('show_score', v)} />
            <TextField label="Note (ex: 4.8)" value={s.score} onChange={v => update('score', v)} />
            <TextField label="Texte sous la note" value={s.score_label} onChange={v => update('score_label', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur icônes" value={s.icon_color} onChange={v => update('icon_color', v)} />
            <ItemsListField
              label="Éléments de confiance" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'select', id: 'icon', label: 'Icône', options: ['check', 'shield', 'truck', 'lock', 'star', 'heart', 'refresh'] },
                { type: 'text', id: 'label', label: 'Texte' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'stock_urgency':
        return (
          <>
            <PaddingFields />
            <TextField label="Message ({'{stock}'} = chiffre dynamique)" value={s.message} onChange={v => update('message', v)} />
            <SliderField label="Stock de départ" value={s.stock_left ?? 7} onChange={v => update('stock_left', v)} min={1} max={50} />
            <SliderField label="Stock minimum (variation)" value={s.stock_min ?? 3} onChange={v => update('stock_min', v)} min={1} max={40} />
            <SliderField label="Stock maximum (variation)" value={s.stock_max ?? 12} onChange={v => update('stock_max', v)} min={2} max={60} />
            <SliderField label="Changement toutes les (sec)" value={s.tick_interval ?? 8} onChange={v => update('tick_interval', v)} min={3} max={30} />
            <SliderField label="Stock total (barre %)" value={s.stock_total ?? 30} onChange={v => update('stock_total', v)} min={5} max={100} />
            <ColorField label="Couleur barre" value={s.bar_color} onChange={v => update('bar_color', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ToggleField label="Afficher ventes du jour" value={s.show_sold_count !== false} onChange={v => update('show_sold_count', v)} />
            <TextField label="Texte ventes" value={s.sold_text} onChange={v => update('sold_text', v)} />
          </>
        )
      case 'circular_ingredients':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ItemsListField
              label="Ingrédients" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'text', id: 'text', label: 'Texte descriptif' },
                { type: 'image', id: 'image_url', label: 'Image' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'expert_encart':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre section" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Nom de l'expert" value={s.name} onChange={v => update('name', v)} />
            <TextField label="Rôle / Titre" value={s.role} onChange={v => update('role', v)} />
            <TextareaField label="Citation / Avis" value={s.quote} onChange={v => update('quote', v)} />
            <ImageUploadField label="Photo de l'expert" value={s.image_url} onChange={v => update('image_url', v)} />
            <ImageUploadField label="Signature (image)" value={s.signature_url} onChange={v => update('signature_url', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
          </>
        )
      case 'upsell_carousel':
        return (
          <>
            <PaddingFields />
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur accentuation" value={s.accent_color} onChange={v => update('accent_color', v)} />
            {products && products.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 mt-4">Produits à afficher</h4>
                <p className="text-[10px] text-gray-400 mb-3">Coche les produits à proposer en upsell depuis ta boutique.</p>
                <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto pr-1">
                  {products.map((p: any) => {
                    const selIds: string[] = s.selected_product_ids || []
                    const isSelected = selIds.includes(p.id)
                    return (
                      <label key={p.id} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...selIds, p.id]
                              : selIds.filter((id: string) => id !== p.id)
                            update('selected_product_ids', next)
                          }}
                          className="w-4 h-4 accent-blue-500 flex-shrink-0"
                        />
                        {(p.images?.[0] || p.image_url) && (
                          <img src={p.images?.[0] || p.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{p.title || p.name}</div>
                          {p.price && <div className="text-[10px] text-gray-500">{p.price} {p.currency || 'FCFA'}</div>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
            <ItemsListField
              label="Produits manuels (si aucun coché)"
              value={s.items}
              onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'title', label: 'Titre Produit' },
                { type: 'text', id: 'price', label: 'Prix' },
                { type: 'image', id: 'image_url', label: 'Image Produit' },
                { type: 'text', id: 'link', label: 'Lien' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'newsletter':
        return (
          <>
            <ToggleField label="Afficher bouton CTA" value={s.show_cta} onChange={v => update('show_cta', v)} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <TextField label="Texte bouton" value={s.button_text} onChange={v => update('button_text', v)} />
            <TextField label="Texte placeholder" value={s.placeholder} onChange={v => update('placeholder', v)} />
            <SelectField label="Type" value={s.type || 'email'} options={['email', 'whatsapp']} onChange={v => update('type', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
          </>
        )
      case 'Hero':
      case 'hero':
        return (
          <>
            <TextField label="Titre" value={s.headline} onChange={v => update('headline', v)} />
            <TextareaField label="Sous-titre" value={s.subheadline} onChange={v => update('subheadline', v)} />
            <TextField label="Texte bouton 1" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <TextField label="Texte bouton 2" value={s.cta_text_2} onChange={v => update('cta_text_2', v)} />
            <ImageUploadField label="Image de fond / principale" value={s.image_url} onChange={v => update('image_url', v)} />
            <SelectField label="Position texte" value={s.text_align || 'left'} options={['left', 'center', 'right']} onChange={v => update('text_align', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
            case 'popup':
      case 'Popup':
        return (
          <>
            <ToggleField label="Activer le pop-up" value={s.enabled !== false} onChange={v => update('enabled', v)} />
            <SelectField label="Déclencheur" value={s.trigger || 'delay'} options={['delay', 'exit', 'scroll']} onChange={v => update('trigger', v)} />
            <SliderField label="Délai (secondes)" value={s.delay_seconds ?? 5} onChange={v => update('delay_seconds', v)} min={0} max={30} />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <TextareaField label="Texte principal" value={s.body_text} onChange={v => update('body_text', v)} />
            <TextField label="Code Promo" value={s.discount_code} onChange={v => update('discount_code', v)} />
            <TextField label="Texte du bouton" value={s.cta_text} onChange={v => update('cta_text', v)} />
            <ImageUploadField label="Image d'illustration" value={s.image_url} onChange={v => update('image_url', v)} />
            <ColorField label="Couleur de fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <ColorField label="Couleur bouton" value={s.cta_color} onChange={v => update('cta_color', v)} />
            <ColorField label="Couleur Overlay (ex: rgba(0,0,0,0.5))" value={s.overlay_color} onChange={v => update('overlay_color', v)} />
          </>
        )
      case 'slideshow':
        return (
          <>
            <ToggleField label="Défilement automatique" value={s.autoplay} onChange={v => update('autoplay', v)} />
            <SliderField label="Hauteur (px)" value={s.height ?? 600} onChange={v => update('height', v)} min={300} max={1000} />
            <ItemsListField
              label="Slides" value={s.slides} onChange={v => update('slides', v)}
              itemSchema={[
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'text', id: 'subtitle', label: 'Sous-titre' },
                { type: 'text', id: 'cta_text', label: 'Bouton' },
                { type: 'image', id: 'image_url', label: 'Image' },
                { type: 'text', id: 'overlay_color', label: 'Couleur overlay (ex: rgba(0,0,0,0.4))' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'hero_editorial':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextareaField label="Contenu éditorial" value={s.content} onChange={v => update('content', v)} rows={6} />
            <SelectField label="Alignement" value={s.text_align || 'center'} options={['left', 'center', 'right']} onChange={v => update('text_align', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
            <SliderField label="Taille titre (px)" value={s.title_font_size ?? 28} onChange={v => update('title_font_size', v)} min={16} max={56} />
          </>
        )
      case 'feature_grid':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur icônes" value={s.icon_color} onChange={v => update('icon_color', v)} />
            <ItemsListField
              label="Fonctionnalités" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'icon', label: 'Icône (emoji)' },
                { type: 'text', id: 'title', label: 'Titre' },
                { type: 'text', id: 'text', label: 'Texte' },
              ] as FieldSchema[]}
            />
          </>
        )
      case 'comparison_vs':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Notre colonne" value={s.our_label || 'NOUS'} onChange={v => update('our_label', v)} />
            <TextField label="Colonne concurrent" value={s.competitor_label || 'EUX'} onChange={v => update('competitor_label', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur accent" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <ItemsListField
              label="Lignes comparaison" value={s.rows} onChange={v => update('rows', v)}
              itemSchema={[
                { type: 'text', id: 'feature', label: 'Fonctionnalité' },
                { type: 'toggle', id: 'us', label: 'Nous ✓' },
                { type: 'toggle', id: 'them', label: 'Eux ✓' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'whats_in_box':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextareaField label="Contenu (liste à puces ✓)" value={s.text} onChange={v => update('text', v)} rows={6} />
            <ImageUploadField label="Image du colis" value={s.image_url} onChange={v => update('image_url', v)} />
            <SelectField label="Position image" value={s.image_position || 'left'} options={['left', 'right']} onChange={v => update('image_position', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur texte" value={s.text_color} onChange={v => update('text_color', v)} />
          </>
        )
      case 'faq_2col':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur accent" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <ItemsListField
              label="Questions" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'question', label: 'Question' },
                { type: 'textarea', id: 'answer', label: 'Réponse' }
              ] as FieldSchema[]}
            />
          </>
        )
      case 'product_grid':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <SelectField label="Colonnes" value={s.columns || 3} options={['1', '2', '3', '4']} onChange={v => update('columns', parseInt(v))} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur icônes" value={s.icon_color} onChange={v => update('icon_color', v)} />
            <ItemsListField
              label="Produits" value={s.items} onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'icon', label: 'Icône' },
                { type: 'text', id: 'title', label: 'Nom' },
                { type: 'text', id: 'text', label: 'Description' },
              ] as FieldSchema[]}
            />
          </>
        )
      case 'PricingTable':
        return (
          <>
            <PaddingFields />
            <TextField label="Titre" value={s.title} onChange={v => update('title', v)} />
            <TextField label="Sous-titre" value={s.subtitle} onChange={v => update('subtitle', v)} />
            <ColorField label="Couleur fond" value={s.bg_color} onChange={v => update('bg_color', v)} />
            <ColorField label="Couleur accent" value={s.accent_color} onChange={v => update('accent_color', v)} />
            <ItemsListField
              label="Offres"
              value={s.items}
              onChange={v => update('items', v)}
              itemSchema={[
                { type: 'text', id: 'title', label: 'Nom de l\'offre' },
                { type: 'text', id: 'price', label: 'Prix' },
                { type: 'text', id: 'description', label: 'Description' },
                { type: 'text', id: 'cta_text', label: 'Texte bouton' },
                { type: 'toggle', id: 'highlighted', label: 'Mise en avant' },
              ] as FieldSchema[]}
            />
          </>
        )
      default:
        return (
          <div className="text-sm text-gray-500">
            Aucun paramètre disponible pour le type <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{block.type}</code>.
          </div>
        )
    }
  }

  const isDeletable = !['Header', 'header', 'AnnouncementBar', 'announcement_bar', 'Footer', 'footer'].includes(block.type)

  return (
    <div className="w-[300px] h-full bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
        <div>
          <h2 className="font-bold text-sm text-gray-800">{block.title}</h2>
          <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Édition</span>
        </div>
        <div className="flex items-center gap-1">
          {isDeletable && (
            <button
              onClick={() => onDelete(block.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors xl:hidden"
              title="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gray-50/30">
        {renderFields()}
        
        {isDeletable && (
          <div className="mt-6 pt-6 border-t border-gray-200/60">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Apparence Globale Section</h4>
            <ColorField label="Couleur de fond" value={s.bg_color || ''} onChange={v => update('bg_color', v)} />
            <PaddingFields />
          </div>
        )}
      </div>
    </div>
  )
}

function VariantOptionsEditor({ value, onChange }: { value: { name: string; values: string[] }[], onChange: (v: any) => void }) {
  const add = () => onChange([...value, { name: '', values: [''] }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const updateGroup = (i: number, field: string, v: any) => {
    const next = value.map((g, idx) => idx === i ? { ...g, [field]: v } : g)
    onChange(next)
  }
  const addValue = (i: number) => {
    updateGroup(i, 'values', [...value[i].values, ''])
  }
  const removeValue = (gi: number, vi: number) => {
    const next = value.map((g, idx) => idx === gi ? { ...g, values: g.values.filter((_, vIdx) => vIdx !== vi) } : g)
    onChange(next)
  }
  const updateValue = (gi: number, vi: number, v: string) => {
    const next = value.map((g, idx) => idx === gi ? { ...g, values: g.values.map((val, vIdx) => vIdx === vi ? v : val) } : g)
    onChange(next)
  }

  return (
    <div className="space-y-3 mb-4">
      {value.map((group, gi) => (
        <div key={gi} className="border border-gray-200 rounded-xl p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Groupe {gi + 1}</span>
            <button type="button" onClick={() => remove(gi)} className="text-red-400 hover:text-red-600 text-xs font-bold">Supprimer</button>
          </div>
          <input
            type="text"
            value={group.name}
            onChange={e => updateGroup(gi, 'name', e.target.value)}
            placeholder="Ex: Taille, Couleur, Parfum…"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg mb-2 focus:outline-none focus:border-blue-400"
          />
          <label className="text-[9px] font-semibold text-gray-400 uppercase block mb-1">Valeurs</label>
          {group.values.map((val, vi) => (
            <div key={vi} className="flex items-center gap-1 mb-1">
              <input
                type="text"
                value={val}
                onChange={e => updateValue(gi, vi, e.target.value)}
                placeholder="Ex: S, M, Rouge, Vanille…"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
              {group.values.length > 1 && (
                <button type="button" onClick={() => removeValue(gi, vi)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addValue(gi)} className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 mt-1">+ Ajouter une valeur</button>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full py-2 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg border border-dashed border-gray-300">+ Ajouter un groupe de variantes</button>
    </div>
  )
}


