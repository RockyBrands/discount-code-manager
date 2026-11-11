import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const secret = process.env.INTERNAL_SHARED_SECRET
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return
  }

  const base = (process.env.APP_URL || process.env.URL || '').replace(/\/$/, '')
  if (!base) return

  try {
    await fetch(`${base}/api/internal/process-removals`, {
      method: 'POST',
      headers: { 'x-internal-secret': secret },
    })
  } catch (err) {
    console.error('Removal worker failed:', err)
  }
}

export const config: Config = {
  background: true,
}
