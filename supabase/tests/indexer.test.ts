/**
 * Indexer DB test suite — runs against local Supabase (`supabase start`).
 *
 * Setup:
 *   cd supabase/tests
 *   pnpm install
 *   # in a separate terminal: supabase start && supabase db push (or db reset)
 *   pnpm test
 *
 * Three suites:
 *   (a) Reconstructability — known sequence → exact state; truncate+replay → identical
 *   (b) Idempotency        — apply same event twice → no-op; OE editions_sold stays correct
 *   (c) RLS as anon        — SELECT ok on projection, INSERT/UPDATE denied, cursor unreadable
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  admin, anon, ADDR,
  resetProjection,
  applyArtistRegistered, applyArtistRevoked,
  applyMintedEvent, applyTransfer, applyBurn,
  applyListingCreated, applySold, applyListingCancelled,
  applyPrimarySaleFixture,
} from './helpers.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getArtist(address: string) {
  const { data } = await admin.from('artists').select('*').eq('address', address).single()
  return data
}
async function getToken(tokenId: number) {
  const { data } = await admin.from('tokens').select('*').eq('token_id', tokenId).single()
  return data
}
async function getListing(listingId: number) {
  const { data } = await admin.from('listings').select('*').eq('listing_id', listingId).single()
  return data
}
async function countSales() {
  const { count } = await admin.from('sales').select('*', { count: 'exact', head: true })
  return count ?? 0
}
async function countTransfers() {
  const { count } = await admin.from('token_transfers').select('*', { count: 'exact', head: true })
  return count ?? 0
}
async function getEffectiveOwner(tokenId: number) {
  const { data } = await admin.from('token_effective_owner').select('effective_owner, active_listing_id').eq('token_id', tokenId).single()
  return data
}

// Capture full projection state as a plain object for comparison.
async function snapshot() {
  const [artists, tokens, listings, sales, transfers] = await Promise.all([
    admin.from('artists').select('*').order('address'),
    admin.from('tokens').select('*').order('token_id'),
    admin.from('listings').select('*').order('listing_id'),
    admin.from('sales').select('*').order('id'),
    admin.from('token_transfers').select('*').order('id'),
  ])
  return {
    artists: artists.data,
    tokens: tokens.data,
    listings: listings.data,
    sales: sales.data,
    transfers: transfers.data,
  }
}

// ── Suite (a): Reconstructability ────────────────────────────────────────────

describe('(a) Reconstructability', () => {
  beforeEach(resetProjection)

  it('primary sale: known sequence produces exact expected state', async () => {
    await applyPrimarySaleFixture()

    const artist = await getArtist(ADDR.alice)
    expect(artist.revoked).toBe(false)
    expect(artist.registered_at_ledger).toBe(100)

    const token = await getToken(0)
    expect(token.owner).toBe(ADDR.bob)
    expect(token.artist).toBe(ADDR.alice)
    expect(token.royalty_bps).toBe(500)
    expect(token.burned).toBe(false)

    const listing = await getListing(0)
    expect(listing.status).toBe('sold')
    expect(listing.editions_sold).toBe(1)
    expect(listing.kind).toBe('fixed_price')

    expect(await countSales()).toBe(1)
    expect(await countTransfers()).toBe(2) // escrow-in + escrow-out
  })

  it('artist revoke updates the row', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyArtistRevoked(ADDR.alice, 110, 'tx_rev', 0)

    const artist = await getArtist(ADDR.alice)
    expect(artist.revoked).toBe(true)
    expect(artist.revoked_at_ledger).toBe(110)
  })

  it('re-registering a revoked artist clears revoked flag', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_r1', 0)
    await applyArtistRevoked(ADDR.alice, 110, 'tx_rev', 0)
    await applyArtistRegistered(ADDR.alice, 120, 'tx_r2', 0)

    const artist = await getArtist(ADDR.alice)
    expect(artist.revoked).toBe(false)
    expect(artist.revoked_at_ledger).toBeNull()
  })

  it('burn marks token as burned and records transfer row', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyMintedEvent({
      tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
      tokenUri: 'ipfs://Qmtest', royaltyBps: 500, recipientsCount: 1,
      ledger: 101, tx: 'tx_mint', eventIndex: 0,
    })
    await applyBurn({ tokenId: 0, from: ADDR.alice, ledger: 102, tx: 'tx_burn', eventIndex: 0 })

    const token = await getToken(0)
    expect(token.burned).toBe(true)
    expect(await countTransfers()).toBe(1)
  })

  it('listing cancel sets status=cancelled', async () => {
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
    await applyListingCancelled(0)

    const listing = await getListing(0)
    expect(listing.status).toBe('cancelled')
  })

  it('truncate + replay produces identical snapshot', async () => {
    await applyPrimarySaleFixture()
    const before = await snapshot()

    await resetProjection()
    await applyPrimarySaleFixture()
    const after = await snapshot()

    // Strip auto-generated ids and timestamps that may differ between runs.
    const normalise = (snap: typeof before) => ({
      artists: snap.artists?.map(({ registered_at_ledger, ...r }) => r),
      tokens: snap.tokens?.map((t) => ({ ...t })),
      listings: snap.listings?.map((l) => ({ ...l })),
      // Compare sales without auto-id (BIGSERIAL resets on truncate + RESTART IDENTITY).
      sales: snap.sales?.map(({ id, ...s }) => s),
      transfers: snap.transfers?.map(({ id, ...t }) => t),
    })
    expect(normalise(after)).toEqual(normalise(before))
  })

  it('effective_owner view: escrowed token shows seller, not marketplace', async () => {
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
    await applyTransfer({ tokenId: 0, from: ADDR.alice, to: ADDR.marketplace, ledger: 102, tx: 'tx_list', eventIndex: 1 })

    const eo = await getEffectiveOwner(0)
    expect(eo?.effective_owner).toBe(ADDR.alice) // seller, not marketplace
    expect(eo?.active_listing_id).toBe(0)
  })
})

// ── Suite (b): Idempotency ────────────────────────────────────────────────────

describe('(b) Idempotency', () => {
  beforeEach(resetProjection)

  it('applying the same ArtistRegistered twice is a no-op', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0) // replay
    const { count } = await admin.from('artists').select('*', { count: 'exact', head: true }).eq('address', ADDR.alice)
    expect(count).toBe(1)
  })

  it('applying the same MintedEvent twice does not create a duplicate token', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyMintedEvent({
      tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
      tokenUri: 'ipfs://Qm', royaltyBps: 500, recipientsCount: 1,
      ledger: 101, tx: 'tx_mint', eventIndex: 0,
    })
    await applyMintedEvent({
      tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
      tokenUri: 'ipfs://Qm', royaltyBps: 500, recipientsCount: 1,
      ledger: 101, tx: 'tx_mint', eventIndex: 0,
    })
    const { count } = await admin.from('tokens').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  it('applying the same Transfer twice results in one token_transfers row', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyMintedEvent({
      tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
      tokenUri: 'ipfs://Qm', royaltyBps: 500, recipientsCount: 1,
      ledger: 101, tx: 'tx_mint', eventIndex: 0,
    })
    await applyTransfer({ tokenId: 0, from: ADDR.alice, to: ADDR.bob, ledger: 102, tx: 'tx_tr', eventIndex: 0 })
    await applyTransfer({ tokenId: 0, from: ADDR.alice, to: ADDR.bob, ledger: 102, tx: 'tx_tr', eventIndex: 0 })
    expect(await countTransfers()).toBe(1)
    expect((await getToken(0)).owner).toBe(ADDR.bob)
  })

  it('FixedPrice Sold: replay does not increment editions_sold past 1', async () => {
    await applyPrimarySaleFixture()

    // Replay the exact same Sold event (same ledger/tx/event_index).
    await applySold({
      ledger: 103, tx: 'tx_buy', eventIndex: 0,
      listingId: 0, tokenId: 0, buyer: ADDR.bob, seller: ADDR.alice,
      price: '100000000', currency: ADDR.xlm,
      royaltyPaid: '0', referralPaid: '0', feePaid: '2500000',
    })

    const listing = await getListing(0)
    expect(listing.editions_sold).toBe(1) // must not be 2
    expect(listing.status).toBe('sold')
    expect(await countSales()).toBe(1)     // only one sale row
  })

  it('OpenEdition: mid-sellthrough replay keeps editions_sold correct', async () => {
    // Setup: OE with 3 editions (tokens 0,1,2)
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    for (let i = 0; i < 3; i++) {
      await applyMintedEvent({
        tokenId: i, artist: ADDR.alice, owner: ADDR.alice,
        tokenUri: `ipfs://Qm${i}`, royaltyBps: 500, recipientsCount: 1,
        ledger: 101, tx: `tx_mint_${i}`, eventIndex: 0,
      })
    }
    await applyListingCreated({
      listingId: 0, nftContract: ADDR.nft, seller: ADDR.alice, tokenId: 0,
      price: '50000000', currency: ADDR.xlm, kind: 'open_edition',
      editionsTotal: 3, endsAt: 0, referralBps: 0, primarySplit: null,
      ledger: 102, tx: 'tx_list', eventIndex: 0,
    })

    // Sell edition 0
    await applySold({
      ledger: 200, tx: 'tx_s0', eventIndex: 0,
      listingId: 0, tokenId: 0, buyer: ADDR.bob, seller: ADDR.alice,
      price: '50000000', currency: ADDR.xlm,
      royaltyPaid: '0', referralPaid: '0', feePaid: '1250000',
    })
    await applyTransfer({ tokenId: 0, from: ADDR.marketplace, to: ADDR.bob, ledger: 200, tx: 'tx_s0', eventIndex: 1 })

    // Replay the same Sold event for edition 0 (simulates duplicate delivery).
    await applySold({
      ledger: 200, tx: 'tx_s0', eventIndex: 0,  // same key → conflict → no-op
      listingId: 0, tokenId: 0, buyer: ADDR.bob, seller: ADDR.alice,
      price: '50000000', currency: ADDR.xlm,
      royaltyPaid: '0', referralPaid: '0', feePaid: '1250000',
    })

    let listing = await getListing(0)
    expect(listing.editions_sold).toBe(1) // still 1, not 2
    expect(listing.status).toBe('active')
    expect(await countSales()).toBe(1)

    // Sell edition 1
    await applySold({
      ledger: 201, tx: 'tx_s1', eventIndex: 0,
      listingId: 0, tokenId: 1, buyer: ADDR.bob, seller: ADDR.alice,
      price: '50000000', currency: ADDR.xlm,
      royaltyPaid: '0', referralPaid: '0', feePaid: '1250000',
    })
    listing = await getListing(0)
    expect(listing.editions_sold).toBe(2)
    expect(listing.status).toBe('active')

    // Effective owner: edition 0 sold (owner=bob), editions 1+2 still escrowed.
    // After selling edition 1 above (transfer not yet applied), token 1 owner
    // is still MARKETPLACE in the tokens table but effective_owner from the listing
    // would show alice for token 2 (editions_sold now 2, so range starts at token_id+2=2).
    const eo2 = await getEffectiveOwner(2)
    expect(eo2?.effective_owner).toBe(ADDR.alice) // unsold, still in escrow

    // Sell edition 2 — closes the listing
    await applySold({
      ledger: 202, tx: 'tx_s2', eventIndex: 0,
      listingId: 0, tokenId: 2, buyer: ADDR.bob, seller: ADDR.alice,
      price: '50000000', currency: ADDR.xlm,
      royaltyPaid: '0', referralPaid: '0', feePaid: '1250000',
    })
    listing = await getListing(0)
    expect(listing.editions_sold).toBe(3)
    expect(listing.status).toBe('sold')
    expect(await countSales()).toBe(3)
  })

  it('applying ListingCreated twice does not duplicate the listing', async () => {
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
    await applyMintedEvent({
      tokenId: 0, artist: ADDR.alice, owner: ADDR.alice,
      tokenUri: 'ipfs://Qm', royaltyBps: 500, recipientsCount: 1,
      ledger: 101, tx: 'tx_mint', eventIndex: 0,
    })
    const listingOpts = {
      listingId: 0, nftContract: ADDR.nft, seller: ADDR.alice, tokenId: 0,
      price: '100000000', currency: ADDR.xlm, kind: 'fixed_price' as const,
      editionsTotal: 1, endsAt: 0, referralBps: 0, primarySplit: null,
      ledger: 102, tx: 'tx_list', eventIndex: 0,
    }
    await applyListingCreated(listingOpts)
    await applyListingCreated(listingOpts) // replay
    const { count } = await admin.from('listings').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })
})

// ── Suite (c): RLS as anon ────────────────────────────────────────────────────

describe('(c) RLS — anon access', () => {
  beforeEach(async () => {
    await resetProjection()
    // Seed one artist row via service_role so SELECT tests have data.
    await applyArtistRegistered(ADDR.alice, 100, 'tx_reg', 0)
  })

  it('anon can SELECT from artists', async () => {
    const { data, error } = await anon.from('artists').select('address')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('anon can SELECT from tokens (may be empty)', async () => {
    const { error } = await anon.from('tokens').select('token_id')
    expect(error).toBeNull()
  })

  it('anon can SELECT from listings (may be empty)', async () => {
    const { error } = await anon.from('listings').select('listing_id')
    expect(error).toBeNull()
  })

  it('anon can SELECT from sales (may be empty)', async () => {
    const { error } = await anon.from('sales').select('id')
    expect(error).toBeNull()
  })

  it('anon can SELECT from token_transfers (may be empty)', async () => {
    const { error } = await anon.from('token_transfers').select('id')
    expect(error).toBeNull()
  })

  it('anon cannot INSERT into artists', async () => {
    const { error } = await anon.from('artists').insert({
      address: 'EVIL',
      registered_at_ledger: 999,
      registered_at_tx: 'tx_evil',
      registered_event_index: 0,
    })
    expect(error).not.toBeNull()
  })

  it('anon cannot UPDATE artists', async () => {
    const { error } = await anon.from('artists').update({ revoked: true }).eq('address', ADDR.alice)
    expect(error).not.toBeNull()
  })

  it('anon cannot DELETE from artists', async () => {
    const { error } = await anon.from('artists').delete().eq('address', ADDR.alice)
    expect(error).not.toBeNull()
  })

  it('anon gets 0 rows from indexer_cursor (no SELECT policy)', async () => {
    // RLS with no policy returns 0 rows (not an error) for SELECT.
    const { data, error } = await anon.from('indexer_cursor').select('last_ledger')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('anon cannot INSERT into indexer_cursor', async () => {
    const { error } = await anon.from('indexer_cursor').insert({ id: 1, last_ledger: 9999 })
    expect(error).not.toBeNull()
  })

  it('anon cannot call apply_artist_registered (function revoked)', async () => {
    const { error } = await anon.rpc('apply_artist_registered', {
      p_artist: 'EVIL',
      p_ledger: 999,
      p_tx: 'tx_evil',
      p_event_index: 0,
    })
    expect(error).not.toBeNull()
  })

  it('anon cannot call apply_sold (function revoked)', async () => {
    const { error } = await anon.rpc('apply_sold', {
      p_ledger: 999, p_tx: 'tx_evil', p_event_index: 0,
      p_listing_id: 0, p_token_id: 0,
      p_buyer: 'EVIL', p_seller: 'EVIL',
      p_price: '1', p_currency: 'XLM',
      p_royalty_paid: '0', p_referral_paid: '0', p_fee_paid: '0',
    })
    expect(error).not.toBeNull()
  })
})
