const SCHEDULE_TAG_REGEX = /\[SCHEDULED:([^\]]+)\]/

export function encodeScheduleNote(scheduledAtIso: string, userNote?: string | null): string {
  const cleanNote = (userNote ?? '').trim()
  return cleanNote ? `[SCHEDULED:${scheduledAtIso}] ${cleanNote}` : `[SCHEDULED:${scheduledAtIso}]`
}

export function parseScheduleNote(rawNote?: string | null): { scheduledAt: string | null; cleanNote: string } {
  if (!rawNote) return { scheduledAt: null, cleanNote: '' }
  const match = rawNote.match(SCHEDULE_TAG_REGEX)
  if (!match) return { scheduledAt: null, cleanNote: rawNote }
  const scheduledAt = match[1]?.trim() || null
  const cleanNote = rawNote.replace(SCHEDULE_TAG_REGEX, '').trim()
  return { scheduledAt, cleanNote }
}

/**
 * Resolves the scheduled ISO timestamp for an order from either `order.scheduled_at`
 * (when migration 0022 is applied) or the latest `Statut : Programmée` event note.
 */
export function resolveOrderScheduledAt(
  order: { status?: string; scheduled_at?: string | null },
  events?: Array<{ event_type?: string; note?: string | null; created_at?: string }> | null,
): { scheduledAt: string | null; cleanNote: string; reminderSent: boolean } {
  if (order.status !== 'scheduled') {
    return { scheduledAt: null, cleanNote: '', reminderSent: false }
  }

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )

  const latestScheduleEvent = sorted.find((e) => e.event_type === 'Statut : Programmée')
  const parsed = parseScheduleNote(latestScheduleEvent?.note)
  const scheduledAt = order.scheduled_at || parsed.scheduledAt || null

  // Reminder is considered sent if a 'Rappel livraison envoyé' event happened AFTER the latest schedule event
  const scheduleEventTime = latestScheduleEvent?.created_at
    ? new Date(latestScheduleEvent.created_at).getTime()
    : 0
  const reminderSent = sorted.some(
    (e) =>
      e.event_type === 'Rappel livraison envoyé' &&
      new Date(e.created_at ?? 0).getTime() >= scheduleEventTime,
  )

  return { scheduledAt, cleanNote: parsed.cleanNote, reminderSent }
}

export function formatScheduledDateFr(isoString?: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()

  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Aujourd’hui à ${timeStr}`
  if (isTomorrow) return `Demain à ${timeStr}`

  const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${dateStr} à ${timeStr}`
}
