import type { Config } from '@netlify/functions'

// Safety net: retries pending cross-store code removals in case the
// webhook-triggered run failed or ran out of time.
export default async () => {
  const secret = process.env.INTERNAL_SHARED_SECRET
  const base = (process.env.APP_URL || process.env.URL || '').replace(/\/$/, '')
  if (!secret || !base) return

  try {
    await fetch(`${base}/api/internal/process-removals`, {
      method: 'POST',
      headers: { 'x-internal-secret': secret },
    })
  } catch (err) {
    console.error('Removal sweep failed:', err)
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
