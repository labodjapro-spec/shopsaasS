'use client'

import { ChevronDown, Store } from 'lucide-react'
import { switchStore } from './actions'

export function StoreSwitcher({
  stores,
  currentId,
}: {
  stores: { id: string; name: string }[]
  currentId: string
}) {
  const current = stores.find(s => s.id === currentId)

  return (
    <form action={switchStore} className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <Store className="size-3.5 text-zinc-400" />
      </div>
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
        className="w-full appearance-none truncate rounded-xl bg-transparent py-2 pl-7 pr-7 text-sm font-semibold outline-none cursor-pointer hover:bg-black/5 transition-colors"
        style={{ maxWidth: '180px' }}
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
        <option value="__new">+ Nouvelle boutique</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
        <ChevronDown className="size-3.5 text-zinc-400" />
      </div>
    </form>
  )
}
