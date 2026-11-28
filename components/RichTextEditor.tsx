'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Grid2X2, ImagePlus,
  Italic, Link2, List, ListOrdered, Minus, Palette, Underline, Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#b45309']
const SIZES = [
  { label: 'Très petit', value: '1' },
  { label: 'Petit',      value: '2' },
  { label: 'Normal',     value: '3' },
  { label: 'Grand',      value: '5' },
  { label: 'Très grand', value: '7' },
]
const MAX_MB = 50

// ─── Handle positions (N / NE / E / SE / S / SW / W / NW) ──────────────────
const HANDLES: { id: string; cursor: string; top: string; left: string; dx: number; dy: number }[] = [
  { id: 'nw', cursor: 'nw-resize', top: '-5px',  left: '-5px',  dx: -1, dy: -1 },
  { id: 'n',  cursor: 'n-resize',  top: '-5px',  left: 'calc(50% - 5px)', dx: 0,  dy: -1 },
  { id: 'ne', cursor: 'ne-resize', top: '-5px',  left: 'calc(100% - 5px)', dx: 1, dy: -1 },
  { id: 'e',  cursor: 'e-resize',  top: 'calc(50% - 5px)', left: 'calc(100% - 5px)', dx: 1, dy: 0 },
  { id: 'se', cursor: 'se-resize', top: 'calc(100% - 5px)', left: 'calc(100% - 5px)', dx: 1, dy: 1 },
  { id: 's',  cursor: 's-resize',  top: 'calc(100% - 5px)', left: 'calc(50% - 5px)', dx: 0, dy: 1 },
  { id: 'sw', cursor: 'sw-resize', top: 'calc(100% - 5px)', left: '-5px', dx: -1, dy: 1 },
  { id: 'w',  cursor: 'w-resize',  top: 'calc(50% - 5px)', left: '-5px', dx: -1, dy: 0 },
]

// ─── ImageResizer overlay ───────────────────────────────────────────────────
function ImageResizer({
  img,
  onDone,
}: {
  img: HTMLImageElement
  onDone: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Keep overlay positioned over the image
  const [rect, setRect] = useState(() => img.getBoundingClientRect())

  useEffect(() => {
    function update() {
      setRect(img.getBoundingClientRect())
    }
    const ro = new ResizeObserver(update)
    ro.observe(img)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [img])

  // Drag resize logic
  function onHandleMouseDown(e: React.MouseEvent, handleId: string) {
    e.preventDefault()
    e.stopPropagation()

    const handle = HANDLES.find((h) => h.id === handleId)!
    const startX = e.clientX
    const startY = e.clientY
    const startW = img.offsetWidth
    const startH = img.offsetHeight

    function onMove(ev: MouseEvent) {
      const dxPx = (ev.clientX - startX) * handle.dx
      const dyPx = (ev.clientY - startY) * handle.dy

      let newW = startW
      let newH = startH

      if (handle.dx !== 0) newW = Math.max(40, startW + dxPx)
      if (handle.dy !== 0) newH = Math.max(40, startH + dyPx)

      if (handle.dx !== 0) img.style.width = `${newW}px`
      if (handle.dy !== 0) img.style.height = `${newH}px`

      img.style.maxWidth = 'none'
      setRect(img.getBoundingClientRect())
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Persist changes into innerHTML via input event
      img.dispatchEvent(new Event('input', { bubbles: true }))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Alignment toolbar
  function setAlign(align: 'left' | 'center' | 'right') {
    if (align === 'center') {
      img.style.display = 'block'
      img.style.marginLeft = 'auto'
      img.style.marginRight = 'auto'
      img.style.float = 'none'
    } else if (align === 'left') {
      img.style.display = 'block'
      img.style.float = 'left'
      img.style.marginLeft = '0'
      img.style.marginRight = '12px'
    } else {
      img.style.display = 'block'
      img.style.float = 'right'
      img.style.marginLeft = '12px'
      img.style.marginRight = '0'
    }
    setRect(img.getBoundingClientRect())
    img.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: 'none',
    zIndex: 9999,
  }

  const alignBtnBase =
    'flex items-center justify-center rounded bg-white/90 p-1 text-zinc-700 shadow hover:bg-violet-100 hover:text-violet-700'

  return (
    <>
      {/* Click-away backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ pointerEvents: 'auto' }}
        onMouseDown={onDone}
      />

      {/* Overlay on the image */}
      <div ref={wrapRef} style={overlayStyle}>
        {/* Blue border */}
        <div
          className="absolute inset-0 rounded"
          style={{
            border: '2px solid #6d28d9',
            pointerEvents: 'none',
          }}
        />

        {/* 8 resize handles */}
        {HANDLES.map((h) => (
          <div
            key={h.id}
            onMouseDown={(e) => onHandleMouseDown(e, h.id)}
            style={{
              position: 'absolute',
              top: h.top,
              left: h.left,
              width: 10,
              height: 10,
              background: '#fff',
              border: '2px solid #6d28d9',
              borderRadius: 2,
              cursor: h.cursor,
              pointerEvents: 'auto',
              zIndex: 10000,
            }}
          />
        ))}

        {/* Alignment toolbar above image */}
        <div
          className="absolute flex gap-1 rounded-lg border border-zinc-200 bg-white/95 px-2 py-1 shadow-lg"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            pointerEvents: 'auto',
            zIndex: 10001,
          }}
        >
          <button type="button" className={alignBtnBase} title="Aligner à gauche" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setAlign('left') }}>
            <AlignLeft className="size-4" />
          </button>
          <button type="button" className={alignBtnBase} title="Centrer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setAlign('center') }}>
            <AlignCenter className="size-4" />
          </button>
          <button type="button" className={alignBtnBase} title="Aligner à droite" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setAlign('right') }}>
            <AlignRight className="size-4" />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main editor ────────────────────────────────────────────────────────────
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  storeId,
  folder,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  storeId: string
  folder: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value
  }, [value])

  // Click on image inside editor → open resizer
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      setSelectedImg(target as HTMLImageElement)
    }
  }, [disabled])

  // Propagate img style changes back to onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    function onInput() {
      onChange(el!.innerHTML)
    }
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
  }, [onChange])

  function exec(name: string, arg?: string) {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(name, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }

  function rememberSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode))
      savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  function insertHtml(html: string) {
    ref.current?.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    onChange(ref.current?.innerHTML ?? '')
  }

  function pickMedia(kind: 'image' | 'video') {
    rememberSelection()
    setMediaKind(kind)
    fileRef.current?.click()
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setBusy(true)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) continue
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`${file.name} dépasse ${MAX_MB} Mo.`)
        continue
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg')
      const path = `${storeId}/${folder}/desc-${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('store-assets').upload(path, file, { cacheControl: '31536000' })
      const url = upErr
        ? await readAsDataUrl(file)
        : supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl
      if (isVideo) {
        insertHtml(`<p><video src="${url}" controls style="max-width:100%;border-radius:12px;margin:12px 0"></video></p>`)
      } else {
        insertHtml(`<p style="text-align:center"><img src="${url}" alt="" style="display:block;margin-left:auto;margin-right:auto;max-width:100%;height:auto;border-radius:12px;margin-top:12px;margin-bottom:12px" /></p>`)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
    setBusy(false)
  }

  function addLink() {
    rememberSelection()
    const url = window.prompt('Adresse du lien (https://…)')
    if (!url) return
    restoreSelection()
    exec('createLink', url)
  }

  function insertTable() {
    insertHtml(
      '<table style="width:100%;border-collapse:collapse;margin:12px 0"><tbody>' +
        '<tr><td style="border:1px solid #d4d4d8;padding:8px">Cellule</td><td style="border:1px solid #d4d4d8;padding:8px">Cellule</td></tr>' +
        '<tr><td style="border:1px solid #d4d4d8;padding:8px">Cellule</td><td style="border:1px solid #d4d4d8;padding:8px">Cellule</td></tr>' +
        '</tbody></table><p><br></p>',
    )
  }

  const btn =
    'rounded-md p-1.5 text-zinc-600 hover:bg-white hover:text-violet-700 disabled:opacity-40'
  const sep = <span className="mx-1 h-5 w-px bg-zinc-200" />

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-200 bg-white', disabled && 'opacity-70')}>
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-zinc-100 bg-zinc-50 p-2">
        <select
          aria-label="Style de texte"
          disabled={disabled}
          defaultValue="p"
          onChange={(e) => exec('formatBlock', e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium"
        >
          <option value="p">Paragraphe</option>
          <option value="h1">Titre 1</option>
          <option value="h2">Titre 2</option>
          <option value="h3">Titre 3</option>
        </select>
        <select
          aria-label="Taille du texte"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = '' }}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium"
        >
          <option value="">Taille</option>
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {sep}
        <button type="button" title="Gras" aria-label="Gras" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={btn}><Bold className="size-4" /></button>
        <button type="button" title="Italique" aria-label="Italique" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={btn}><Italic className="size-4" /></button>
        <button type="button" title="Souligné" aria-label="Souligné" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={btn}><Underline className="size-4" /></button>
        {sep}
        <button type="button" title="Aligner à gauche" aria-label="Aligner à gauche" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')} className={btn}><AlignLeft className="size-4" /></button>
        <button type="button" title="Centrer" aria-label="Centrer" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')} className={btn}><AlignCenter className="size-4" /></button>
        <button type="button" title="Aligner à droite" aria-label="Aligner à droite" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')} className={btn}><AlignRight className="size-4" /></button>
        {sep}
        <button type="button" title="Liste à puces" aria-label="Liste à puces" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} className={btn}><List className="size-4" /></button>
        <button type="button" title="Liste numérotée" aria-label="Liste numérotée" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')} className={btn}><ListOrdered className="size-4" /></button>
        <button type="button" title="Tableau" aria-label="Tableau" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={insertTable} className={btn}><Grid2X2 className="size-4" /></button>
        <button type="button" title="Séparateur" aria-label="Séparateur" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertHorizontalRule')} className={btn}><Minus className="size-4" /></button>
        <button type="button" title="Lien" aria-label="Lien" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={addLink} className={btn}><Link2 className="size-4" /></button>
        {sep}
        <button type="button" title="Insérer une photo" aria-label="Insérer une photo" disabled={disabled || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMedia('image')} className={btn}><ImagePlus className="size-4" /></button>
        <button type="button" title="Insérer une vidéo" aria-label="Insérer une vidéo" disabled={disabled || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMedia('video')} className={btn}><Video className="size-4" /></button>
        {sep}
        <label className="relative flex cursor-pointer items-center gap-1 rounded-md p-1.5 text-zinc-600 hover:bg-white" title="Couleur du texte">
          <Palette className="size-4" />
          <input type="color" aria-label="Couleur du texte" defaultValue="#111827" disabled={disabled} onChange={(e) => exec('foreColor', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Couleur ${c}`} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('foreColor', c)} className="size-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={mediaKind === 'image' ? 'image/*' : 'video/*'}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* ── Editable area ── */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={rememberSelection}
        onClick={handleEditorClick}
        className="min-h-[220px] px-4 py-3 text-[15px] leading-relaxed text-zinc-800 outline-none focus:ring-4 focus:ring-violet-100 [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:my-2 [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:rounded-xl [&_table]:w-full"
        data-placeholder="Décris ton produit : bénéfices, usage, conseils…"
      />

      {(busy || error) && (
        <div className="border-t border-zinc-100 px-4 py-2 text-xs">
          {busy && <span className="text-violet-600">Envoi du fichier…</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}

      {/* ── Image resizer overlay (rendered outside editor flow via portal-like fixed positioning) ── */}
      {selectedImg && (
        <ImageResizer
          img={selectedImg}
          onDone={() => {
            onChange(ref.current?.innerHTML ?? '')
            setSelectedImg(null)
          }}
        />
      )}
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('lecture'))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
