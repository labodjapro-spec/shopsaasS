'use client'

import { Store } from 'lucide-react'
import { switchStore } from './actions'

export function StoreSwitcher({
  stores,
  currentId,
}: {
  stores: { id: string; name: string }[]
  currentId: string
}) {
  return (
    <form action={switchStore} className="w-full">
      <label className="relative flex items-center gap-2 cursor-pointer w-full rounded-xl px-3 py-2 hover:bg-black/5 transition-colors">
        <Store className="size-4 shrink-0 opacity-50" />
        <select
          name="store_id"
          defaultValue={currentId}
          onChange={(e) => {
            if (e.target.value === '__new') {
              window.location.href = '/onboarding?new=1'
              return
            }
            e.currentTarget.form?.requestSubmit()
          }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="__new">+ Nouvelle boutique</option>
        </select>
        <span className="flex-1 truncate text-sm font-semibold">
          {stores.find(s => s.id === currentId)?.name ?? 'Ma boutique'}
        </span>
        <svg className="size-4 shrink-0 opacity-40" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </label>
    </form>
  )
}
