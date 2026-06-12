/**
 * End-to-end poller test (three runs).
 *
 * Run 1 — fresh start from ledger 3043900: picks up all fixture events + token 6.
 * Run 2 — continue from tip cursor: 0 events (soft idempotency).
 * Run 3 — rewind cursor to 3043900, re-process the same 17 events:
 *          tables must be identical to after Run 1 (hard idempotency).
 *
 * Run from repo root:
 *   node_modules/.pnpm/node_modules/.bin/tsx apps/web/scripts/poll-test.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Must run before poller/config.ts is imported (dynamic import below).
config({ path: resolve(import.meta.dirname, '../../../.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env')
  process.exit(1)
}

const START_LEDGER = 3043900

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

type Row = Record<string, unknown>

async function resetAndRewind() {
  const { error } = await db.rpc('reset_projection')
  if (error) throw new Error(`reset_projection: ${error.message}`)
  await rewind()
}

async function rewind() {
  const { error } = await db.rpc('advance_cursor', {
    p_last_ledger: START_LEDGER,
    p_last_cursor: null,
  })
  if (error) throw new Error(`advance_cursor: ${error.message}`)
  console.log(`  cursor rewound to ledger ${START_LEDGER}`)
}

interface Snapshot {
  artists: Row[]
  tokens: Row[]
  listings: Row[]
  sales: Row[]
  transfers: Row[]
  cursorLedger: number
}

async function snapshot(): Promise<Snapshot> {
  const [a, t, l, s, tr, cur] = await Promise.all([
    db.from('artists').select('address, revoked, registered_at_ledger').order('registered_at_ledger'),
    db.from('tokens').select('token_id, owner, artist, token_uri, royalty_bps, minted_at_ledger').order('token_id'),
    db.from('listings').select('listing_id, token_id, status, price, editions_sold').order('listing_id'),
    db.from('sales').select('listing_id, token_id, price, royalty_paid, fee_paid').order('listing_id, token_id'),
    db.from('token_transfers').select('token_id, from_address, to_address, ledger').order('ledger, token_id'),
    db.from('indexer_cursor').select('last_ledger').eq('id', 1).single(),
  ])
  return {
    artists:   (a.data ?? []) as Row[],
    tokens:    (t.data ?? []) as Row[],
    listings:  (l.data ?? []) as Row[],
    sales:     (s.data ?? []) as Row[],
    transfers: (tr.data ?? []) as Row[],
    cursorLedger: ((cur.data as { last_ledger: number } | null)?.last_ledger ?? 0),
  }
}

function printSnapshot(label: string, snap: Snapshot) {
  console.log(`\n─── ${label} ───`)
  console.log(`artists   (${snap.artists.length}):`)
  for (const a of snap.artists) console.log(`  ${String(a.address).slice(0,10)}… revoked=${a.revoked} L${a.registered_at_ledger}`)
  console.log(`tokens    (${snap.tokens.length}):`)
  for (const t of snap.tokens) console.log(`  #${t.token_id} owner=${String(t.owner).slice(0,10)}… uri=${t.token_uri} bps=${t.royalty_bps} L${t.minted_at_ledger}`)
  console.log(`listings  (${snap.listings.length}):`)
  for (const l of snap.listings) console.log(`  #${l.listing_id} token=${l.token_id} status=${l.status} price=${l.price} editions_sold=${l.editions_sold}`)
  console.log(`sales     (${snap.sales.length}):`)
  for (const s of snap.sales) console.log(`  listing#${s.listing_id} token=${s.token_id} price=${s.price} royalty=${s.royalty_paid} fee=${s.fee_paid}`)
  console.log(`transfers (${snap.transfers.length})`)
  console.log(`cursor    last_ledger=${snap.cursorLedger}`)
}

function assertSnapshotsEqual(before: Snapshot, after: Snapshot) {
  const errs: string[] = []

  const check = (name: string, a: Row[], b: Row[]) => {
    if (a.length !== b.length) errs.push(`${name}: ${a.length} → ${b.length} rows (expected same)`)
    // Deep-compare each row by JSON (order is the same — both sorted the same way)
    a.forEach((row, i) => {
      if (JSON.stringify(row) !== JSON.stringify(b[i])) {
        errs.push(`${name}[${i}] changed:\n  before: ${JSON.stringify(row)}\n  after:  ${JSON.stringify(b[i])}`)
      }
    })
  }

  check('artists',   before.artists,   after.artists)
  check('tokens',    before.tokens,    after.tokens)
  check('listings',  before.listings,  after.listings)
  check('sales',     before.sales,     after.sales)
  check('transfers', before.transfers, after.transfers)

  if (errs.length) {
    console.error('\nFAIL — hard idempotency broken:')
    errs.forEach(e => console.error('  ' + e))
    process.exit(1)
  }
}

async function main() {
  const { pollOnce } = await import('../app/api/indexer/poller.js')

  // ── Run 1: fresh start ─────────────────────────────────────────────────────
  console.log('\n══ RUN 1: pollOnce() from fresh state ══')
  await resetAndRewind()
  const r1 = await pollOnce()
  console.log(`  processedEvents=${r1.processedEvents} latestLedger=${r1.latestLedger}`)
  const snap1 = await snapshot()
  printSnapshot('after run 1', snap1)

  // ── Run 2: soft idempotency ────────────────────────────────────────────────
  console.log('\n══ RUN 2: pollOnce() from tip cursor (soft idempotency) ══')
  const r2 = await pollOnce()
  console.log(`  processedEvents=${r2.processedEvents} latestLedger=${r2.latestLedger}`)
  if (r2.processedEvents > 0) {
    console.error('FAIL — soft idempotency: run2 processed events already applied')
    process.exit(1)
  }
  console.log('  PASS — run2 applied 0 events')

  // ── Run 3: hard idempotency — rewind and re-process ───────────────────────
  console.log('\n══ RUN 3: rewind to 3043900, re-process same 17 events (hard idempotency) ══')
  await rewind()
  const r3 = await pollOnce()
  console.log(`  processedEvents=${r3.processedEvents} latestLedger=${r3.latestLedger}`)
  const snap3 = await snapshot()
  printSnapshot('after run 3', snap3)

  console.log('\n── Diff run1 vs run3 ──')
  assertSnapshotsEqual(snap1, snap3)

  console.log('\n══ ALL PASS ══')
  console.log('  Run 1: 17 events projected from scratch')
  console.log('  Run 2: 0 events (soft idempotency — no re-apply from tip)')
  console.log(`  Run 3: ${r3.processedEvents} events re-processed, tables identical (hard idempotency)`)
}

main().catch(err => { console.error(err); process.exit(1) })
