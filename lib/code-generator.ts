import crypto from 'crypto'
import { prisma } from './prisma'

// No ambiguous characters: excludes 0, O, 1, I, L
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const RANDOM_LENGTH = 8
const MAX_ROUNDS = 25

function randomSegment(length: number) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_CHARSET[crypto.randomInt(CODE_CHARSET.length)]
  }
  return out
}

/** `{PREFIX}{8 random}{YY}` — 12 chars, e.g. RBX7KQ2MN427 */
export function generateEntityCode(prefix: string, year: number) {
  const yy = (year % 100).toString().padStart(2, '0')
  return `${prefix}${randomSegment(RANDOM_LENGTH)}${yy}`
}

/**
 * Generates `count` unique entity codes, silently regenerating any code that
 * already exists in DiscountCode (any group). Throws after MAX_ROUNDS.
 */
export async function generateUniqueEntityCodes(
  prefix: string,
  year: number,
  count: number,
): Promise<string[]> {
  const codes = new Set<string>()

  for (let round = 0; round < MAX_ROUNDS && codes.size < count; round++) {
    const needed = count - codes.size
    const candidates = new Set<string>()
    while (candidates.size < needed * 2) {
      candidates.add(generateEntityCode(prefix, year))
    }

    const taken = await prisma.discountCode.findMany({
      where: { code: { in: Array.from(candidates) } },
      select: { code: true },
    })
    const takenSet = new Set(taken.map(t => t.code))

    for (const candidate of Array.from(candidates)) {
      if (codes.size >= count) break
      if (!takenSet.has(candidate) && !codes.has(candidate)) {
        codes.add(candidate)
      }
    }
  }

  if (codes.size < count) {
    throw new Error(`Could not generate ${count} unique codes after ${MAX_ROUNDS} attempts`)
  }
  return Array.from(codes)
}
