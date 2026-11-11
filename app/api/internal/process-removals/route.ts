import { NextRequest, NextResponse } from 'next/server'
import { processPendingRemovals } from '@/lib/redemption'

export async function POST(request: NextRequest) {
  const expected = process.env.INTERNAL_SHARED_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'INTERNAL_SHARED_SECRET not configured' }, { status: 500 })
  }
  const provided = request.headers.get('x-internal-secret')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processPendingRemovals()
  return NextResponse.json(result)
}
