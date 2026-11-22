'use client'

import { useMemo } from 'react'

type DayData = {
  date: string
  revenue: number
  count: number
  delivered: number
  cancelled: number
}

type StatusData = {
  key: string
  label: string
  color: string
  count: number
  total: number
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatK(n: number, currency: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`
  return `${n.toLocaleString('fr-FR')} ${currency}`
}

/** Graphe en barres SVG simple */
function BarChart({
  data,
  valueKey,
  color,
  label,
  currency,
  showCount = false,
}: {
  data: DayData[]
  valueKey: 'revenue' | 'count'
  color: string
  label: string
  currency: string
  showCount?: boolean
}) {
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1)
  const W = 600
  const H = 160
  const PAD_LEFT = 48
  const PAD_BOT = 32
  const barW = data.length > 0 ? Math.max(4, Math.floor((W - PAD_LEFT) / data.length) - 2) : 8
  const gap = data.length > 0 ? (W - PAD_LEFT) / data.length : 1

  // Afficher max 10 labels sur l'axe X
  const step = Math.max(1, Math.ceil(data.length / 10))

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">{label}</p>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
          Pas de données sur cette période
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + PAD_BOT}`} className="w-full" style={{ height: 200 }}>
          {/* Lignes de grille */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = PAD_BOT / 2 + (H - PAD_BOT / 2) * (1 - r)
            return (
              <g key={r}>
                <line x1={PAD_LEFT} y1={y} x2={W} y2={y} stroke="#f4f4f5" strokeWidth={1} />
                <text x={PAD_LEFT - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#a1a1aa">
                  {valueKey === 'revenue' ? formatK(maxVal * r, '') : Math.round(maxVal * r)}
                </text>
              </g>
            )
          })}

          {/* Barres */}
          {data.map((d, i) => {
            const h = Math.max(2, ((d[valueKey] / maxVal) * (H - PAD_BOT / 2 - 8)))
            const x = PAD_LEFT + i * gap + (gap - barW) / 2
            const y = H - PAD_BOT / 2 - h + 2
            return (
              <g key={d.date}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={color}
                  opacity={0.85}
                />
                {/* Label axe X */}
                {i % step === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H + PAD_BOT / 2 - 2}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#a1a1aa"
                  >
                    {formatDate(d.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/** Donut SVG pour la répartition par statut */
function DonutChart({ byStatus }: { byStatus: StatusData[] }) {
  const total = byStatus.reduce((s, d) => s + d.count, 0)
  if (total === 0) return (
    <div className="flex h-48 items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
      Pas de données
    </div>
  )

  const R = 60
  const CX = 80
  const CY = 80
  let angle = -Math.PI / 2

  const slices = byStatus.map(s => {
    const pct = s.count / total
    const sweep = pct * 2 * Math.PI
    const x1 = CX + R * Math.cos(angle)
    const y1 = CY + R * Math.sin(angle)
    angle += sweep
    const x2 = CX + R * Math.cos(angle)
    const y2 = CY + R * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return { ...s, pct, x1, y1, x2, y2, large }
  })

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path
            key={s.key}
            d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
            fill={s.color}
            opacity={0.9}
          />
        ))}
        {/* Trou central */}
        <circle cx={CX} cy={CY} r={36} fill="white" />
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#18181b">
          {total}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize={9} fill="#a1a1aa">
          commandes
        </text>
      </svg>
      <div className="flex flex-wrap gap-2">
        {slices.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-zinc-600 font-semibold">
              {s.label} <span className="text-zinc-400 font-normal">({s.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComptaCharts({
  dailyData,
  byStatus,
  currency,
}: {
  dailyData: DayData[]
  byStatus: StatusData[]
  currency: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Évolution du CA */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-zinc-900 mb-4">Évolution du chiffre d'affaires</h2>
        <BarChart
          data={dailyData}
          valueKey="revenue"
          color="#7c3aed"
          label={`CA actif par jour (${currency})`}
          currency={currency}
        />
      </div>

      {/* Nombre de commandes par jour */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-zinc-900 mb-4">Commandes par jour</h2>
        <BarChart
          data={dailyData}
          valueKey="count"
          color="#10b981"
          label="Nombre de commandes"
          currency={currency}
          showCount
        />
      </div>

      {/* Donut statuts */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-zinc-900 mb-4">Répartition par statut</h2>
        <DonutChart byStatus={byStatus} />
      </div>

      {/* Livrées vs Annulées */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-zinc-900 mb-4">Livrées vs Annulées par jour</h2>
        <div className="space-y-3">
          {dailyData.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
              Pas de données
            </div>
          ) : (
            <svg viewBox={`0 0 600 160`} className="w-full" style={{ height: 180 }}>
              {(() => {
                const max = Math.max(...dailyData.map(d => Math.max(d.delivered, d.cancelled)), 1)
                const H = 130
                const PAD = 32
                const gap = 600 / dailyData.length
                const bW = Math.max(3, Math.floor(gap / 3))
                const step = Math.max(1, Math.ceil(dailyData.length / 10))
                return dailyData.map((d, i) => {
                  const hD = Math.max(d.delivered > 0 ? 2 : 0, (d.delivered / max) * (H - 20))
                  const hC = Math.max(d.cancelled > 0 ? 2 : 0, (d.cancelled / max) * (H - 20))
                  const xBase = i * gap + gap / 2
                  return (
                    <g key={d.date}>
                      {/* Livrées */}
                      <rect x={xBase - bW - 1} y={H - hD} width={bW} height={hD} rx={2} fill="#22c55e" opacity={0.85} />
                      {/* Annulées */}
                      <rect x={xBase + 1} y={H - hC} width={bW} height={hC} rx={2} fill="#ef4444" opacity={0.85} />
                      {i % step === 0 && (
                        <text x={xBase} y={H + 16} textAnchor="middle" fontSize={8} fill="#a1a1aa">
                          {formatDate(d.date)}
                        </text>
                      )}
                    </g>
                  )
                })
              })()}
            </svg>
          )}
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-zinc-600">Livrées</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-zinc-600">Annulées</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
