import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Neon serverless driver over WebSocket (port 443). Works from networks that
// block outbound TCP 5432 and is the recommended driver for serverless hosts.
// Migrations still use DIRECT_URL over TCP (build/CLI path only).
neonConfig.webSocketConstructor = ws

function createPrismaClient() {
  if (process.env.NODE_ENV === 'production') return new PrismaClient()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter: new PrismaNeon(pool) })
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || createPrismaClient()

global.prisma = prisma
