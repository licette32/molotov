/**
 * GET /api/indexer
 *
 * Triggers one poll run: fetches all on-chain events since the last cursor,
 * projects them into Supabase, and advances the cursor.
 *
 * Intended to be called by Vercel Cron or an external scheduler.
 * Protect with a shared secret in production:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { pollOnce } from './poller'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // Optional bearer-token guard (skip when CRON_SECRET is unset — local dev).
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await pollOnce()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[indexer] pollOnce error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
