import { requireSuperAdmin } from '@/lib/admin/require-super-admin'
import { createClient } from '@/lib/supabase/server'
import { BanButton, DeleteButton } from './AdminActions'
import { Shield, Users, Store, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { adminClient } = await requireSuperAdmin()

  // Récupérer tous les utilisateurs via le service role
  const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(error.message)

  // Récupérer toutes les boutiques avec le nombre de membres
  const supabase = await createClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, slug, owner_id, created_at')
    .order('created_at', { ascending: false })

  // Grouper les boutiques par owner_id
  const storesByOwner = new Map<string, typeof stores>()
  for (const store of stores ?? []) {
    const list = storesByOwner.get(store.owner_id) ?? []
    list.push(store)
    storesByOwner.set(store.owner_id, list)
  }

  const totalUsers = users.length
  const bannedUsers = users.filter(u => u.banned_until && new Date(u.banned_until) > new Date()).length
  const totalStores = stores?.length ?? 0

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-700 text-white">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900">Panneau Admin</h1>
            <p className="text-sm text-zinc-500">Gestion des comptes ShopSaaS</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100">
                <Users className="size-5 text-violet-700" />
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">{totalUsers}</p>
                <p className="text-xs text-zinc-500">Comptes inscrits</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
                <Store className="size-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">{totalStores}</p>
                <p className="text-xs text-zinc-500">Boutiques créées</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-100">
                <AlertTriangle className="size-5 text-orange-700" />
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">{bannedUsers}</p>
                <p className="text-xs text-zinc-500">Comptes bloqués</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table des utilisateurs */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-zinc-900">Tous les comptes ({totalUsers})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wide">Inscription</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wide">Boutiques</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wide">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {users.map((u) => {
                  const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date())
                  const userStores = storesByOwner.get(u.id) ?? []
                  const name = (u.user_metadata?.full_name as string | undefined) || ''
                  const initials = name ? name.trim().slice(0, 1).toUpperCase() : (u.email?.slice(0, 1).toUpperCase() ?? '?')
                  const createdAt = new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                  const lastSign = u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    : '—'

                  return (
                    <tr key={u.id} className={`hover:bg-zinc-50 transition-colors ${isBanned ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                            {initials}
                          </div>
                          <div>
                            {name && <p className="font-semibold text-zinc-900">{name}</p>}
                            <p className="text-zinc-500 text-xs">{u.email}</p>
                            <p className="text-zinc-400 text-[10px] mt-0.5">Dernière connexion : {lastSign}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-500">{createdAt}</td>
                      <td className="px-6 py-4">
                        {userStores.length === 0 ? (
                          <span className="text-zinc-400 text-xs">Aucune</span>
                        ) : (
                          <div className="space-y-1">
                            {userStores.map(s => (
                              <div key={s.id} className="flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-xs font-medium text-zinc-700">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                            <span className="size-1.5 rounded-full bg-red-500" />
                            Bloqué
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BanButton userId={u.id} banned={isBanned} />
                          <DeleteButton userId={u.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
