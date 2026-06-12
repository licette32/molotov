/**
 * Continuous indexer loop.
 *
 * Calls pollOnce() on every tick, then sleeps POLL_INTERVAL_MS (default 6 s).
 * 6 s ≈ one Stellar ledger — keeps the projection within one ledger of the tip.
 *
 * Run from repo root:
 *   node_modules/.pnpm/node_modules/.bin/tsx apps/web/scripts/run-indexer.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(import.meta.dirname, '../../../.env') })

const INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? '6000')

const { pollOnce } = await import('../app/api/indexer/poller.js')

console.log(`[indexer] starting — interval=${INTERVAL_MS}ms`)

while (true) {
  try {
    const { processedEvents, latestLedger } = await pollOnce()
    if (processedEvents > 0)
      console.log(`[indexer] +${processedEvents} events  ledger=${latestLedger}`)
  } catch (err) {
    console.error('[indexer] poll error:', err)
  }
  await new Promise(resolve => setTimeout(resolve, INTERVAL_MS))
}
