import crypto from 'crypto'

const PREFIX = 'enc:v1:'

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('Missing TOKEN_ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  return key
}

export function encryptSecret(plaintext: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(value: string) {
  if (!value.startsWith(PREFIX)) return value
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}
