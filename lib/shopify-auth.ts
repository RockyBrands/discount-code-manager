import crypto from 'crypto'

export function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

export function sanitizeShopDomain(shop: string) {
  const trimmed = shop.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(trimmed)) {
    throw new Error('Invalid shop domain')
  }
  return trimmed
}

export function getAppUrl(req?: { url: string }) {
  const configured = process.env.APP_URL
  if (configured) return configured.replace(/\/$/, '')
  if (!req) throw new Error('Missing APP_URL')
  return new URL(req.url).origin
}

export function generateNonce(length = 16) {
  return crypto.randomBytes(length).toString('hex')
}

export function safeCompare(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

export function verifyWebhookHmac(rawBody: string, hmacHeader: string, secret: string) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')
  return safeCompare(digest, hmacHeader)
}

export function verifyHmac(params: Record<string, string>, secret: string) {
  const { hmac, ...rest } = params
  if (!hmac) return false

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray((rest as any)[key]) ? (rest as any)[key].join(',') : rest[key]}`)
    .join('&')

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return safeCompare(digest, hmac)
}
