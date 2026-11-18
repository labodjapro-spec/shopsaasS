'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { X, PanelLeft, Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Toolbar from './Toolbar'
import SidebarLeft from './SidebarLeft'
import Canvas from './Canvas'
import PropertiesPanel from './PropertiesPanel'
import { ensureOrderFormSettings } from '@/lib/store-builder/form-presets'

function hydrateEditorData(data: EditorData, products: any[] = [], productId: string | null): EditorData {
  const product = products.find(p => p.id === productId) || products[0]
  const unitPrice = product?.price ? Number(product.price) : 15000
  const currency = product?.currency || 'FCFA'

  const hydrateBlock = (block: EditorBlock): EditorBlock => {
    if (block.type !== 'OrderForm' && block.type !== 'order_form') return block
    return {
      ...block,
      settings: ensureOrderFormSettings(block.settings || {}, unitPrice, currency),
    }
  }

  const header = [...(data.header || [])]
  const hasHeader = header.some(b => b.type === 'Header' || b.type === 'header')
  if (!hasHeader) {
    header.unshift({
      id: `h-header-${Date.now()}`,
      type: 'Header',
      title: 'En-tête',
      hidden: false,
      settings: { logo_position: 'center', show_cart: true, show_search: false },
    })
  }

  return {
    ...data,
    header,
    template: (data.template || []).map(hydrateBlock),
  }
}

export interface EditorBlock {
  id: string
  type: string
  title: string
  hidden: boolean
  settings: Record<string, any>
}

export interface EditorData {
  header: EditorBlock[]
  template: EditorBlock[]
  footer: EditorBlock[]
  themeSettings?: Record<string, any>
  selectedProductId?: string | null
}

interface EditorProps {
  storeId: string
  storeName?: string
  storeSlug?: string
  returnHref?: string
  storeStatus?: string
  initialData: EditorData
  products?: any[]
  apiBase?: string
}

export default function Editor({ storeId, storeName, storeSlug, returnHref = '/dashboard', storeStatus = 'draft', initialData, products, apiBase = '' }: EditorProps) {
  const integrationStoreId = initialData?.themeSettings?.store_id || storeId
  const initialProductId = initialData?.selectedProductId || (products && products.length > 0 ? products[0].id : null)
  const [data, setData] = useState<EditorData>(() => hydrateEditorData(initialData, products || [], initialProductId))
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'sections' | 'theme_settings'>('sections')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('mobile')
  const [themeFocusMode, setThemeFocusMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [status, setStatus] = useState(storeStatus)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialProductId)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const brandingSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const isFirstRender = useRef(true)

  // ── Mobile drawer state ──
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [propsPanelOpen, setPropsPanelOpen] = useState(false)

  // Initialiser les paramètres de thème si absents
  const [themeSettings, setThemeSettings] = useState<Record<string, any>>(initialData.themeSettings || {
    primaryColor: '#E8527A',
    secondaryColor: '#FFF8F3',
    backgroundColor: '#FFF8F3',
    textColor: '#3A2A2E',
    fontFamily: 'Plus Jakarta Sans',
    textSoftColor: '#7A6469',
    accentDeep: '#C23A5E',
    gold: '#C9A24B',
    border: '#F0D9D2',
    surface: '#FFFFFF',
  })

  // Ref pour l'auto-save — APRÈS themeSettings pour éviter "used before declaration"
  const latestSaveData = useRef({ data, themeSettings, selectedProductId })

  // Trouver le bloc sélectionné dans toutes les zones
  const allBlocks = [...data.header, ...data.template, ...data.footer]
  const selectedBlock = allBlocks.find(b => b.id === selectedBlockId) || null
  const selectedProduct = products?.find(p => p.id === selectedProductId) || products?.[0] || null

  // Quand un bloc est sélectionné, ouvrir le panneau propriétés sur mobile
  useEffect(() => {
    if (selectedBlockId) setPropsPanelOpen(true)
  }, [selectedBlockId])

  // Mettre à jour le ref à chaque changement d'état
  useEffect(() => {
    latestSaveData.current = { data, themeSettings, selectedProductId }
  }, [data, themeSettings, selectedProductId])

  // Marquer comme non sauvegardé + planifier l'auto-save
  useEffect(() => {
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // Utilise le ref pour avoir les données les plus récentes (pas de stale closure)
      handleSaveWithData(latestSaveData.current.data, latestSaveData.current.themeSettings, latestSaveData.current.selectedProductId)
    }, 30000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [data, themeSettings, selectedProductId])

  // Sync logo thème → bloc Header (boutique publique)
  useEffect(() => {
    if (!themeSettings.logo_url?.trim()) return
    setData(prev => ({
      ...prev,
      header: prev.header.map(b =>
        (b.type === 'Header' || b.type === 'header')
          ? {
              ...b,
              settings: {
                ...b.settings,
                logo_image: themeSettings.logo_url,
                logo_height: themeSettings.logo_height ?? 40,
              },
            }
          : b
      ),
    }))
  }, [themeSettings.logo_url, themeSettings.logo_height])
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (brandingSaveTimer.current) clearTimeout(brandingSaveTimer.current)
    brandingSaveTimer.current = setTimeout(() => {
      const { data: d, themeSettings: ts, selectedProductId: pid } = latestSaveData.current
      handleSaveWithData(d, ts, pid)
    }, 800)
    return () => { if (brandingSaveTimer.current) clearTimeout(brandingSaveTimer.current) }
  }, [themeSettings.logo_url, themeSettings.favicon_url])

  // Sauvegarder avec des données explicites (auto-save via ref — pas de stale closure)
  async function handleSaveWithData(d: EditorData, ts: Record<string, any>, pid: string | null) {
    setSaving(true)
    const dataToSave = { ...d, themeSettings: ts, selectedProductId: pid }
    try {
      const response = await fetch(`${apiBase}/api/stores/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, builderJson: dataToSave }),
      })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error(result.error || 'Erreur inconnue')
      setSaved(true)
    } catch (err: any) {
      console.error('[Editor AutoSave Error]:', err)
    } finally {
      setSaving(false)
    }
  }

  // Sauvegarder dans Supabase (manuel — utilise l'état React courant)
  async function handleSave() {
    setSaving(true)
    const dataToSave = { ...data, themeSettings, selectedProductId }
    
    try {
      const response = await fetch(`${apiBase}/api/stores/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          builderJson: dataToSave,
        })
      })

      const result = await response.json()
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erreur inconnue')
      }

      setSaved(true)
      toast.success('Page sauvegardée avec succès !')
    } catch (err: any) {
      console.error('[Editor Save Error]:', err)
      toast.error(`Échec de la sauvegarde : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Publier / mettre en pause la boutique → met à jour stores.status
  // et store_pages.is_published. Sauvegarde aussi le builder au passage.
  const handlePublish = useCallback(async (nextStatus: 'published' | 'paused' | 'draft') => {
    setSaving(true)
    const dataToSave = { ...data, themeSettings, selectedProductId }
    
    try {
      const response = await fetch(`${apiBase}/api/stores/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          builderJson: dataToSave,
          isPublished: nextStatus === 'published',
          status: nextStatus,
        })
      })

      const result = await response.json()
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erreur inconnue')
      }

      setStatus(nextStatus)
      setSaved(true)
      if (nextStatus === 'published') {
        toast.success('Page publiée avec succès !')
      } else if (nextStatus === 'paused') {
        toast.success('Page mise en pause !')
      } else {
        toast.success('Page dépubliée !')
      }
    } catch (err: any) {
      console.error('[Editor Publish Error]:', err)
      toast.error(`Échec de l'action : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [data, themeSettings, selectedProductId, storeId])

  // Mettre à jour les settings d'un bloc
  const updateBlockSettings = useCallback((blockId: string, newSettings: Record<string, any>) => {
    setData(prev => {
      const updateInList = (list: EditorBlock[]) =>
        list.map(b => b.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : b)
      return {
        header: updateInList(prev.header),
        template: updateInList(prev.template),
        footer: updateInList(prev.footer),
      }
    })
  }, [])

  // Toggle visibilité d'un bloc
  const toggleBlockVisibility = useCallback((blockId: string) => {
    setData(prev => {
      const toggle = (list: EditorBlock[]) =>
        list.map(b => b.id === blockId ? { ...b, hidden: !b.hidden } : b)
      return {
        header: toggle(prev.header),
        template: toggle(prev.template),
        footer: toggle(prev.footer),
      }
    })
  }, [])

  // Supprimer un bloc du template
  const deleteBlock = useCallback((blockId: string) => {
    setData(prev => ({
      ...prev,
      template: prev.template.filter(b => b.id !== blockId),
    }))
    setSelectedBlockId(null)
    setPropsPanelOpen(false)
  }, [])

  // Dupliquer un bloc du template
  const duplicateBlock = useCallback((blockId: string) => {
    setData(prev => {
      const blockToDuplicate = prev.template.find(b => b.id === blockId)
      if (!blockToDuplicate) return prev
      const newBlock: EditorBlock = {
        ...blockToDuplicate,
        id: `${blockToDuplicate.type}-${Date.now()}`,
        title: `${blockToDuplicate.title} (copie)`,
      }
      const insertIndex = prev.template.findIndex(b => b.id === blockId) + 1
      const newTemplate = [...prev.template]
      newTemplate.splice(insertIndex, 0, newBlock)
      return { ...prev, template: newTemplate }
    })
  }, [])

  // Ajouter un bloc au template
  const addBlock = useCallback((type: string, title: string, defaultSettings: Record<string, any>) => {
    const newBlock: EditorBlock = {
      id: `${type}-${Date.now()}`,
      type,
      title,
      hidden: false,
      settings: defaultSettings,
    }
    setData(prev => ({
      ...prev,
      template: [...prev.template, newBlock],
    }))
    setSelectedBlockId(newBlock.id)
    // Fermer la sidebar mobile et ouvrir le panel propriétés immédiatement
    setSidebarOpen(false)
    setPropsPanelOpen(true)
  }, [])

  // Réordonner les blocs du template (avec garde-fou contre les index hors limites)
  const reorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
    setData(prev => {
      const len = prev.template.length
      if (toIndex < 0 || toIndex >= len || fromIndex < 0 || fromIndex >= len) return prev
      const newTemplate = [...prev.template]
      const [moved] = newTemplate.splice(fromIndex, 1)
      newTemplate.splice(toIndex, 0, moved)
      return { ...prev, template: newTemplate }
    })
  }, [])

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#f1f2f4]">
      <Toolbar
        storeName={storeName || 'Ma Boutique'}
        storeId={storeId}
        storeSlug={storeSlug}
        returnHref={returnHref}
        storeStatus={status}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        onPublish={handlePublish}
        apiBase={apiBase}
        currentThemeId={themeSettings?.themeId ?? initialData?.themeSettings?.themeId}
        selectedProductId={selectedProductId}
        onThemeApplied={(newBuilderJson: any) => {
          // 1. Mettre à jour les blocs
          const newData = hydrateEditorData(
            newBuilderJson,
            products || [],
            newBuilderJson.selectedProductId ?? selectedProductId,
          )
          setData(newData)
          // 2. Fusionner les themeSettings — PRÉSERVER market_id, store_id, api_base, currency
          setThemeSettings({
            ...(newBuilderJson.themeSettings || {}),
            // Conserver les champs critiques pour les commandes
            market_id: newBuilderJson.themeSettings?.market_id ?? themeSettings.market_id,
            store_id: newBuilderJson.themeSettings?.store_id ?? themeSettings.store_id,
            api_base: newBuilderJson.themeSettings?.api_base ?? themeSettings.api_base,
            currency: newBuilderJson.themeSettings?.currency ?? themeSettings.currency,
          })
          // 3. Conserver le produit sélectionné
          if (newBuilderJson.selectedProductId) {
            setSelectedProductId(newBuilderJson.selectedProductId)
          }
          setSaved(false)
          toast.success('Thème appliqué !')
        }}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── SIDEBAR GAUCHE ── masquée en mode "Personnaliser le thème" (style Shopify) ── */}
        {!themeFocusMode && (
          <div className="hidden md:block flex-shrink-0">
<SidebarLeft
                storeId={integrationStoreId}
                data={data}
                selectedBlockId={selectedBlockId}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab)
                  if (tab === 'theme_settings') setThemeFocusMode(true)
                }}
                onSelectBlock={(id) => { setSelectedBlockId(id); setSidebarOpen(false) }}
                onToggleVisibility={toggleBlockVisibility}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onAddBlock={addBlock}
                onReorder={reorderBlocks}
                themeSettings={themeSettings}
                onUpdateThemeSettings={setThemeSettings}
                onClose={undefined}
              />
          </div>
        )}
        {/* Mode thème plein écran : panneau thème flottant à gauche */}
        {themeFocusMode && (
          <div className="hidden md:block flex-shrink-0 w-[320px] animate-drawer-left">
            <SidebarLeft
              storeId={integrationStoreId}
              data={data}
              selectedBlockId={selectedBlockId}
              activeTab="theme_settings"
              onTabChange={(tab) => {
                setActiveTab(tab)
                if (tab === 'sections') setThemeFocusMode(false)
              }}
              onSelectBlock={(id) => { setSelectedBlockId(id); setSidebarOpen(false) }}
              onToggleVisibility={toggleBlockVisibility}
              onDeleteBlock={deleteBlock}
              onDuplicateBlock={duplicateBlock}
              onAddBlock={addBlock}
              onReorder={reorderBlocks}
              themeSettings={themeSettings}
              onUpdateThemeSettings={setThemeSettings}
              onClose={() => { setThemeFocusMode(false); setActiveTab('sections') }}
              themeFocusMode
            />
          </div>
        )}
        {/* Mobile: overlay drawer (slide-in gauche avec backdrop fade) */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[300px] md:hidden animate-drawer-left">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-3 right-3 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
              <SidebarLeft
                storeId={integrationStoreId}
                data={data}
                selectedBlockId={selectedBlockId}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onSelectBlock={(id) => { setSelectedBlockId(id); setSidebarOpen(false) }}
                onToggleVisibility={toggleBlockVisibility}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onAddBlock={addBlock}
                onReorder={reorderBlocks}
                themeSettings={themeSettings}
                onUpdateThemeSettings={setThemeSettings}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </>
        )}

        {/* ── CANVAS (centre) ── */}
        <Canvas
          data={data}
          selectedBlockId={selectedBlockId}
          previewMode={previewMode}
          onSelectBlock={setSelectedBlockId}
          products={products}
          selectedProductId={selectedProductId}
          onProductChange={setSelectedProductId}
          themeSettings={themeSettings}
        />

        {/* ── PANNEAU PROPRIÉTÉS ── Desktop large: fixe | sinon: drawer overlay animé ── */}
        {selectedBlockId && (
          <>
            {/* Desktop large (xl+) : assez d'espace pour 3 colonnes */}
            <div className="hidden xl:block flex-shrink-0">
              <PropertiesPanel
                block={selectedBlock}
                onUpdateSettings={updateBlockSettings}
                onDelete={deleteBlock}
                selectedProduct={selectedProduct}
                products={products}
              />
            </div>
            {/* Mobile/tablet/desktop-petit: overlay drawer (sous xl) slide-in droite */}
            {propsPanelOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 xl:hidden transition-opacity duration-300"
                  onClick={() => setPropsPanelOpen(false)}
                />
                <div className="fixed inset-y-0 right-0 z-50 w-[300px] xl:hidden animate-drawer-right">
                  <PropertiesPanel
                    block={selectedBlock}
                    onUpdateSettings={updateBlockSettings}
                    onDelete={deleteBlock}
                    onClose={() => setPropsPanelOpen(false)}
                    selectedProduct={selectedProduct}
                    products={products}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── BOUTONS FLOTTANTS ── pour ouvrir sidebar (mobile) / propriétés (sous xl) ── */}
      <div className="fixed bottom-4 right-4 z-30 flex flex-col gap-2">
        {selectedBlock && (
          <button
            onClick={() => setPropsPanelOpen(!propsPanelOpen)}
            className="xl:hidden w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
            title="Propriétés"
          >
            <Settings2 size={20} />
          </button>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          title="Sections"
        >
          <PanelLeft size={20} />
        </button>
      </div>
    </div>
  )
}
