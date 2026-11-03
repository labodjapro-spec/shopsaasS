/**
 * Fire-and-forget call to the Supabase Edge Function that sends Web Push.
 * Secrets remain server-side; push failure never rolls back a real order.
 */
export async function dispatchOrderPush(storeId: string, orderId: string) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const hookSecret = process.env.PUSH_HOOK_SECRET
  if (!projectUrl || !hookSecret) return

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
    if (!response.ok) {
      console.warn('[push] Edge Function returned', response.status)
    }
  } catch (error) {
    console.warn('[push] unable to dispatch notification:', error)
  }
}
