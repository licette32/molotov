/**
 * Cloud RLS + function-permission security test against the real Supabase project.
 * Run from supabase/tests/ (keys are loaded from ../../.env automatically):
 *   pnpm run cloud-security
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: resolve(import.meta.dirname, '../../.env') })

const URL = process.env.SUPABASE_URL
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SEC = process.env.SUPABASE_SECRET_KEY ?? ''

if (!URL || !PUB || !SEC) {
  console.error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set in .env')
  process.exit(1)
}

const publishable: SupabaseClient = createClient(URL, PUB, { auth: { persistSession: false } })
const secret: SupabaseClient = createClient(URL, SEC, { auth: { persistSession: false } })

const ALICE = 'GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM'
let passed = 0, failed = 0

function ok(label: string) { console.log(`PASS  ${label}`); passed++ }
function fail(label: string, detail: string) { console.error(`FAIL  ${label}  — ${detail}`); failed++ }

// ── seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  await secret.rpc('reset_projection')
  const { error } = await secret.rpc('apply_artist_registered', {
    p_artist: ALICE, p_ledger: 100, p_tx: 'tx_seed', p_event_index: 0,
  })
  if (error) throw new Error(`seed failed: ${error.message}`)
}

// ── 1. Publishable SELECT permissions ─────────────────────────────────────────
async function testSelect() {
  console.log('\n── publishable: SELECT ──')

  const { data: a, error: e1 } = await publishable.from('artists').select('*')
  if (e1) fail('p1 SELECT artists', e1.message)
  else if ((a as unknown[]).length >= 1) ok('p1 SELECT artists (1 row)')
  else fail('p1 SELECT artists', 'expected ≥1 row, got 0')

  for (const [id, tbl] of [['p2','tokens'],['p3','listings'],['p4','sales'],['p5','token_transfers'],['p6','token_effective_owner']] as const) {
    const { error } = await publishable.from(tbl).select('*')
    if (error) fail(`${id} SELECT ${tbl}`, error.message)
    else ok(`${id} SELECT ${tbl}`)
  }

  // indexer_cursor: SELECT granted but 0 rows (no SELECT policy → RLS blocks all)
  const { data: cur, error: ce } = await publishable.from('indexer_cursor').select('*')
  if (ce) fail('p7 indexer_cursor 0 rows', ce.message)
  else if ((cur as unknown[]).length === 0) ok('p7 indexer_cursor 0 rows (RLS blocks)')
  else fail('p7 indexer_cursor 0 rows', `got ${(cur as unknown[]).length} rows — RLS not blocking`)
}

// ── 2. Publishable writes — must not mutate data ──────────────────────────────
// RLS: no INSERT/UPDATE/DELETE policy → 0 rows affected, no error.
// The real check is that the underlying data was NOT modified.
async function testWrites() {
  console.log('\n── publishable: writes must not mutate data ──')

  // INSERT: expect error (no INSERT policy → PostgREST should block)
  const { error: insErr } = await publishable.from('artists').insert({
    address: 'EVIL', registered_at_ledger: 999, registered_at_tx: 'tx_evil', registered_event_index: 0,
  })
  if (insErr) ok('p8 INSERT artists blocked')
  else {
    // If no error, verify the row doesn't actually exist (secondary check)
    const { data: chk } = await secret.from('artists').select('*').eq('address', 'EVIL')
    if ((chk as unknown[]).length === 0) ok('p8 INSERT artists: 0 rows inserted (RLS no-op)')
    else fail('p8 INSERT artists', 'EVIL row was actually inserted!')
  }

  // UPDATE: no UPDATE policy → 0 rows modified; verify original row unchanged.
  await publishable.from('artists').update({ revoked: true }).eq('address', ALICE)
  const { data: afterUpdate } = await secret.from('artists').select('revoked').eq('address', ALICE).single()
  if ((afterUpdate as { revoked: boolean } | null)?.revoked === false)
    ok('p9 UPDATE artists: row not modified (RLS blocks)')
  else
    fail('p9 UPDATE artists', `row was mutated: revoked=${JSON.stringify((afterUpdate as { revoked?: boolean } | null)?.revoked)}`)

  // DELETE: no DELETE policy → 0 rows removed; verify row still exists.
  await publishable.from('artists').delete().eq('address', ALICE)
  const { data: afterDel } = await secret.from('artists').select('address').eq('address', ALICE)
  if ((afterDel as unknown[]).length === 1) ok('p10 DELETE artists: row not deleted (RLS blocks)')
  else fail('p10 DELETE artists', 'row was actually deleted!')

  // UPDATE indexer_cursor: no policy; verify last_ledger unchanged (still =100)
  await publishable.from('indexer_cursor').update({ last_ledger: 9999 }).eq('id', 1)
  const { data: cur } = await secret.from('indexer_cursor').select('last_ledger').eq('id', 1).single()
  if ((cur as { last_ledger: number } | null)?.last_ledger !== 9999)
    ok('p11 UPDATE indexer_cursor: not modified (RLS blocks)')
  else
    fail('p11 UPDATE indexer_cursor', 'last_ledger was changed to 9999!')
}

// ── 3. Publishable cannot call apply_* functions ──────────────────────────────
async function testFunctions() {
  console.log('\n── publishable: apply_* must be revoked ──')

  const { error: e12 } = await publishable.rpc('apply_artist_registered', {
    p_artist: 'EVIL', p_ledger: 999, p_tx: 'tx_evil', p_event_index: 0,
  })
  if (e12) ok('p12 apply_artist_registered revoked')
  else fail('p12 apply_artist_registered', 'call succeeded — REVOKE FROM PUBLIC not working')

  const { error: e13 } = await publishable.rpc('apply_sold', {
    p_ledger: 999, p_tx: 'tx_evil', p_event_index: 0,
    p_listing_id: 0, p_token_id: 0, p_buyer: 'EVIL', p_seller: 'EVIL',
    p_price: '1', p_currency: 'XLM', p_royalty_paid: '0', p_referral_paid: '0', p_fee_paid: '0',
  })
  if (e13) ok('p13 apply_sold revoked')
  else fail('p13 apply_sold', 'call succeeded — REVOKE FROM PUBLIC not working')
}

// ── 4. Secret key: indexer writes succeed ────────────────────────────────────
async function testSecretKey() {
  console.log('\n── secret key: indexer must be able to write ──')

  const { error: se1 } = await secret.rpc('apply_artist_registered', {
    p_artist: ALICE, p_ledger: 200, p_tx: 'tx_check', p_event_index: 0,
  })
  if (se1) fail('s1 apply_artist_registered', se1.message)
  else ok('s1 apply_artist_registered works')

  const { error: se2 } = await secret.rpc('advance_cursor', {
    p_last_ledger: 200, p_last_cursor: 'test-cursor',
  })
  if (se2) fail('s2 advance_cursor', se2.message)
  else ok('s2 advance_cursor works')

  const { data: cur, error: ce } = await secret.from('indexer_cursor').select('last_ledger').eq('id', 1).single()
  if (ce) fail('s3 secret SELECT indexer_cursor', ce.message)
  else if ((cur as { last_ledger: number } | null)?.last_ledger === 200) ok('s3 secret SELECT indexer_cursor (last_ledger=200)')
  else fail('s3 secret SELECT indexer_cursor', `unexpected: ${JSON.stringify(cur)}`)

  const { data: arts } = await publishable.from('artists').select('address')
  if ((arts as unknown[]).length >= 1) ok('s4 publishable sees registered artist')
  else fail('s4 publishable sees registered artist', 'no rows visible')
}

// ── main ──────────────────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║  Cloud Security Check                ║`)
  console.log(`║  ${URL.replace('https://', '')}  ║`)
  console.log(`╚══════════════════════════════════════╝`)

  try {
    await seed()
    await testSelect()
    await testWrites()
    await testFunctions()
    await testSecretKey()
  } finally {
    try { await secret.rpc('reset_projection') } catch {}
  }

  console.log(`\n══ ${passed} passed, ${failed} failed ══\n`)
  process.exit(failed > 0 ? 1 : 0)
})()
