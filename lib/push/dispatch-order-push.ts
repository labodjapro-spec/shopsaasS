/**
 * Fire-and-forget call to the Supabase Edge Function that sends Web Push.
 * Secrets remain server-side; push failure never rolls back a real order.
 */
export async function dispatchOrderPush(storeId: string, orderId: string) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const hookSecret = process.env.PUSH_HOOK_SECRET?.trim()
  if (!projectUrl || !hookSecret) {
    console.warn('[push] skipped: NEXT_PUBLIC_SUPABASE_URL or PUSH_HOOK_SECRET is missing on the server')
    return
  }

  try {
    const response = await fetch(`${projectUrl}/functions/v1/push-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-hook-secret': hookSecret,
      },
      body: JSON.stringify({ storeId, orderId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
    const result = await response.text().catch(() => '')
    if (!response.ok) {
      console.warn('[push] Edge Function returned', response.status, result.slice(0, 500))
    } else {
      console.info('[push] Edge Function result:', result.slice(0, 500))
    }
  } catch (error) {
    console.warn('[push] unable to dispatch notification:', error)
  }
}

/**
 * Sends a Web Push notification for a scheduled order whose delivery time has arrived.
 */
export async function dispatchScheduledReminderPush(
  storeId: string,
  orderId: string,
  note?: string,
): Promise<boolean> {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const hookSecret = process.env.PUSH_HOOK_SECRET?.trim()
  if (!projectUrl || !hookSecret) return false

  try {
    const response = await fetch(`${projectUrl}/functions/v1/push-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-hook-secret': hookSecret,
      },
      body: JSON.stringify({
        storeId,
        orderId,
        kind: 'scheduled_reminder',
        note: note || '',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
    return response.ok
  } catch (error) {
    console.warn('[push] unable to dispatch scheduled reminder:', error)
    return false
  }
}
