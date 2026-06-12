/**
 * Test helpers for the Molotov indexer DB test suite.
 *
 * Prerequisites: `supabase start` is running and migrations have been applied
 * via `supabase db push` (or `supabase db reset`).
 *
 * Connection: uses the well-known default local Supabase keys.
 * Override with env vars if your project uses different ports/keys.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'

// Standard keys emitted by `supabase start` for local dev.
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0'

export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqHDan4pXoJ5bZgMaQhKk2KkKhfpJtXsE'

/** Service-role client: bypasses RLS, used by the indexer and test setup. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

/** Anon client: subject to RLS, used to verify access policies. */
export const anon: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
})

// ── Reset ──────────────────────────────────────────────────────────────────

export async function resetProjection() {
  const { error } = await admin.rpc('reset_projection')
  if (error) throw new Error(`reset_projection failed: ${error.message}`)
}

// ── Event application helpers (thin wrappers around the DB functions) ──────
// These call the same SECURITY DEFINER functions the poller will call.

export async function applyArtistRegistered(
  artist: string,
  ledger: number,
  tx: string,
  eventIndex: number,
) {
  const { error } = await admin.rpc('apply_artist_registered', {
    p_artist: artist,
    p_ledger: ledger,
    p_tx: tx,
    p_event_index: eventIndex,
  })
  if (error) throw new Error(`apply_artist_registered: ${error.message}`)
}

export async function applyArtistRevoked(
  artist: string,
  ledger: number,
  tx: string,
  eventIndex: number,
) {
  const { error } = await admin.rpc('apply_artist_revoked', {
    p_artist: artist,
    p_ledger: ledger,
    p_tx: tx,
    p_event_index: eventIndex,
  })
  if (error) throw new Error(`apply_artist_revoked: ${error.message}`)
}

export async function applyMintedEvent(opts: {
  tokenId: number
  artist: string
  owner: string
  tokenUri: string
  royaltyBps: number
  recipientsCount: number
  ledger: number
  tx: string
  eventIndex: number
}) {
  const { error } = await admin.rpc('apply_minted_event', {
    p_token_id: opts.tokenId,
    p_artist: opts.artist,
    p_owner: opts.owner,
    p_token_uri: opts.tokenUri,
    p_royalty_bps: opts.royaltyBps,
    p_recipients_count: opts.recipientsCount,
    p_ledger: opts.ledger,
    p_tx: opts.tx,
    p_event_index: opts.eventIndex,
  })
  if (error) throw new Error(`apply_minted_event: ${error.message}`)
}

export async function applyTransfer(opts: {
  tokenId: number
  from: string
  to: string
  ledger: number
  tx: string
  eventIndex: number
}) {
  const { error } = await admin.rpc('apply_transfer', {
    p_token_id: opts.tokenId,
    p_from: opts.from,
    p_to: opts.to,
    p_ledger: opts.ledger,
    p_tx: opts.tx,
    p_event_index: opts.eventIndex,
  })
  if (error) throw new Error(`apply_transfer: ${error.message}`)
}

export async function applyBurn(opts: {
  tokenId: number
  from: string
  ledger: number
  tx: string
  eventIndex: number
}) {
  const { error } = await admin.rpc('apply_burn', {
    p_token_id: opts.tokenId,
    p_from: opts.from,
    p_ledger: opts.ledger,
    p_tx: opts.tx,
    p_event_index: opts.eventIndex,
  })
  if (error) throw new Error(`apply_burn: ${error.message}`)
}

export async function applyListingCreated(opts: {
  listingId: number
  nftContract: string
  seller: string
  tokenId: number
  price: string
  currency: string
  kind: 'fixed_price' | 'open_edition' | 'auction'
  editionsTotal: number
  endsAt: number
  referralBps: number
  primarySplit: object | null
  ledger: number
  tx: string
  eventIndex: number
}) {
  const { error } = await admin.rpc('apply_listing_created', {
    p_listing_id: opts.listingId,
    p_nft_contract: opts.nftContract,
    p_seller: opts.seller,
    p_token_id: opts.tokenId,
    p_price: opts.price,
    p_currency: opts.currency,
    p_kind: opts.kind,
    p_editions_total: opts.editionsTotal,
    p_ends_at: opts.endsAt,
    p_referral_bps: opts.referralBps,
    p_primary_split: opts.primarySplit,
    p_ledger: opts.ledger,
    p_tx: opts.tx,
    p_event_index: opts.eventIndex,
  })
  if (error) throw new Error(`apply_listing_created: ${error.message}`)
}

export async function applySold(opts: {
  ledger: number
  tx: string
  eventIndex: number
  listingId: number
  tokenId: number
  buyer: string
  seller: string
  price: string
  currency: string
  royaltyPaid: string
  referralPaid: string
  feePaid: string
}) {
  const { error } = await admin.rpc('apply_sold', {
    p_ledger: opts.ledger,
    p_tx: opts.tx,
    p_event_index: opts.eventIndex,
    p_listing_id: opts.listingId,
    p_token_id: opts.tokenId,
    p_buyer: opts.buyer,
    p_seller: opts.seller,
    p_price: opts.price,
    p_currency: opts.currency,
    p_royalty_paid: opts.royaltyPaid,
    p_referral_paid: opts.referralPaid,
    p_fee_paid: opts.feePaid,
  })
  if (error) throw new Error(`apply_sold: ${error.message}`)
}

export async function applyListingCancelled(listingId: number) {
  const { error } = await admin.rpc('apply_listing_cancelled', {
    p_listing_id: listingId,
  })
  if (error) throw new Error(`apply_listing_cancelled: ${error.message}`)
}

// ── Fixture: a known primary-sale sequence ─────────────────────────────────
// Mint token 0 to alice, fixed-price listing, bought by bob.
// Returns the exact expected DB state for reconstructability assertions.

export const ADDR = {
  alice: 'ALICE',
  bob: 'BOB',
  marketplace: 'MARKETPLACE',
  nft: 'NFT_CONTRACT',
  xlm: 'XLM_SAC',
}

export async function applyPrimarySaleFixture() {
  await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
  await applyMintedEvent({
    tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
    tokenUri: 'ipfs://Qmtest', royaltyBps: 500, recipientsCount: 1,
    ledger: 101, tx: 'tx_mint', eventIndex: 0,
  })
  await applyListingCreated({
    listingId: 0, nftContract: ADDR.nft, seller: ADDR.alice, tokenId: 0,
    price: '100000000', currency: ADDR.xlm, kind: 'fixed_price',
    editionsTotal: 1, endsAt: 0, referralBps: 0, primarySplit: null,
    ledger: 102, tx: 'tx_list', eventIndex: 0,
  })
  // Transfer: alice → marketplace (escrow in)
  await applyTransfer({ tokenId: 0, from: ADDR.alice, to: ADDR.marketplace, ledger: 102, tx: 'tx_list', eventIndex: 1 })
  // Buy
  await applySold({
    ledger: 103, tx: 'tx_buy', eventIndex: 0,
    listingId: 0, tokenId: 0, buyer: ADDR.bob, seller: ADDR.alice,
    price: '100000000', currency: ADDR.xlm,
    royaltyPaid: '0', referralPaid: '0', feePaid: '2500000',
  })
  // Transfer: marketplace → bob (escrow out)
  await applyTransfer({ tokenId: 0, from: ADDR.marketplace, to: ADDR.bob, ledger: 103, tx: 'tx_buy', eventIndex: 1 })
}
