/**
 * Decoder test against real XDR from testnet.
 *
 * Fixture captured on 2026-06-12 from live transactions on testnet:
 *   revoke(ADMIN)                               → ArtistRevoked
 *   register(ADMIN)                             → ArtistRegistered
 *   mint(artist=ADMIN, tokenUri="ipfs://fixture-a", royalty_bps=1000) → token_id 4
 *   mint(artist=ADMIN, tokenUri="ipfs://fixture-b", royalty_bps=1000) → token_id 5
 *   list(seller=ADMIN, token_id=4, price=1_000_000_000, FixedPrice)   → listing_id 2
 *   buy(buyer=ADMIN, listing_id=2)
 *   list(seller=ADMIN, token_id=5, ...)                               → listing_id 3
 *   cancel(seller=ADMIN, listing_id=3)
 *   burn(from=ADMIN, token_id=5)
 *
 * Regenerate fixture: re-run those CLI invocations, call getEvents, save
 * each event as { contractId, topic: string[], value: string, txHash, ledger,
 * inSuccessfulContractCall } where topic/value are base64-encoded XDR.
 */
import { describe, expect, it } from 'vitest'
import { xdr, rpc } from '@stellar/stellar-sdk'
import { decodeEvent } from './decode'
import type { DecodedEvent } from './decode'
import fixtureRaw from './decode-fixture.json'
import { MARKET_ID, NFT_ID } from './config'

// ── constants ─────────────────────────────────────────────────────────────────

const ADMIN   = 'GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM'
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

// ── fixture hydration ─────────────────────────────────────────────────────────

type FixtureEntry = (typeof fixtureRaw)[number]

function fromFixture(entry: FixtureEntry): rpc.Api.EventResponse {
  return {
    topic: entry.topic.map(t => xdr.ScVal.fromXDR(t, 'base64')),
    value: xdr.ScVal.fromXDR(entry.value, 'base64'),
    txHash: entry.txHash,
    ledger: entry.ledger,
    inSuccessfulContractCall: entry.inSuccessfulContractCall,
  } as unknown as rpc.Api.EventResponse
}

const events  = fixtureRaw.map(fromFixture)
const decoded = events.map(decodeEvent)

// ── helpers ───────────────────────────────────────────────────────────────────

const findAll = <K extends DecodedEvent['kind']>(kind: K) =>
  decoded.filter((d): d is Extract<DecodedEvent, { kind: K }> => d.kind === kind)

// ── suite ─────────────────────────────────────────────────────────────────────

describe('decodeEvent — real XDR fixture from testnet', () => {

  // ── ArtistRegistry ──────────────────────────────────────────────────────────

  it('ArtistRevoked: artist=ADMIN', () => {
    const ev = findAll('ArtistRevoked').find(d => d.artist === ADMIN)
    expect(ev, 'ArtistRevoked(ADMIN) missing').toBeDefined()
    expect(ev!.kind).toBe('ArtistRevoked')
    expect(ev!.artist).toBe(ADMIN)
  })

  it('ArtistRegistered: artist=ADMIN', () => {
    const ev = findAll('ArtistRegistered').find(d => d.artist === ADMIN)
    expect(ev, 'ArtistRegistered(ADMIN) missing').toBeDefined()
    expect(ev!.kind).toBe('ArtistRegistered')
    expect(ev!.artist).toBe(ADMIN)
  })

  // ── MolotovNft ─────────────────────────────────────────────────────────────

  it('MintedEvent token_id=4: royaltyBps=1000, recipientsCount=1, artist/recipient=ADMIN', () => {
    const ev = findAll('MintedEvent').find(d => d.tokenId === 4)
    expect(ev, 'MintedEvent(4) missing').toBeDefined()
    expect(ev!.tokenId).toBe(4)
    expect(ev!.royaltyBps).toBe(1000)
    expect(ev!.recipientsCount).toBe(1)
    expect(ev!.artist).toBe(ADMIN)
    expect(ev!.recipient).toBe(ADMIN)
  })

  it('MintedEvent token_id=5: same royalty config', () => {
    const ev = findAll('MintedEvent').find(d => d.tokenId === 5)
    expect(ev, 'MintedEvent(5) missing').toBeDefined()
    expect(ev!.tokenId).toBe(5)
    expect(ev!.royaltyBps).toBe(1000)
    expect(ev!.recipientsCount).toBe(1)
  })

  it('Transfer token_id=4 (escrow on list): from=ADMIN, to=marketplace', () => {
    const ev = findAll('Transfer').find(d => d.tokenId === 4 && d.from === ADMIN)
    expect(ev, 'Transfer(4, ADMIN→marketplace) missing').toBeDefined()
    expect(ev!.tokenId).toBe(4)
    expect(ev!.from).toBe(ADMIN)
    expect(ev!.to).toBe(MARKET_ID)
  })

  it('Transfer token_id=4 (release on buy): from=marketplace, to=ADMIN', () => {
    const ev = findAll('Transfer').find(d => d.tokenId === 4 && d.from === MARKET_ID)
    expect(ev, 'Transfer(4, marketplace→ADMIN) missing').toBeDefined()
    expect(ev!.tokenId).toBe(4)
    expect(ev!.from).toBe(MARKET_ID)
    expect(ev!.to).toBe(ADMIN)
  })

  it('Transfer token_id=5 (escrow on list): from=ADMIN, to=marketplace', () => {
    const ev = findAll('Transfer').find(d => d.tokenId === 5 && d.from === ADMIN)
    expect(ev, 'Transfer(5, ADMIN→marketplace) missing').toBeDefined()
    expect(ev!.from).toBe(ADMIN)
    expect(ev!.to).toBe(MARKET_ID)
  })

  it('Transfer token_id=5 (return on cancel): from=marketplace, to=ADMIN', () => {
    const ev = findAll('Transfer').find(d => d.tokenId === 5 && d.from === MARKET_ID)
    expect(ev, 'Transfer(5, marketplace→ADMIN) missing').toBeDefined()
    expect(ev!.from).toBe(MARKET_ID)
    expect(ev!.to).toBe(ADMIN)
  })

  it('Burn token_id=5: from=ADMIN', () => {
    const ev = findAll('Burn').find(d => d.tokenId === 5)
    expect(ev, 'Burn(5) missing').toBeDefined()
    expect(ev!.tokenId).toBe(5)
    expect(ev!.from).toBe(ADMIN)
  })

  // ── Marketplace ─────────────────────────────────────────────────────────────

  it('ListingCreated listing_id=2: all fields correct', () => {
    const ev = findAll('ListingCreated').find(d => d.listingId === 2n)
    expect(ev, 'ListingCreated(2) missing').toBeDefined()
    expect(ev!.listingId).toBe(2n)
    expect(ev!.tokenId).toBe(4)
    expect(ev!.seller).toBe(ADMIN)
    expect(ev!.nft).toBe(NFT_ID)
    expect(ev!.listingKind).toBe('fixed_price')
    expect(ev!.price).toBe('1000000000')
    expect(ev!.currency).toBe(XLM_SAC)
    expect(ev!.editionsTotal).toBe(1)
    expect(ev!.endsAt).toBe(0n)
    expect(ev!.referralBps).toBe(0)
    expect(ev!.primarySplit).toBeNull()
  })

  it('Sold listing_id=2: price/royalty/fee/referral correct', () => {
    const ev = findAll('Sold').find(d => d.listingId === 2n)
    expect(ev, 'Sold(2) missing').toBeDefined()
    expect(ev!.listingId).toBe(2n)
    expect(ev!.tokenId).toBe(4)
    expect(ev!.buyer).toBe(ADMIN)
    expect(ev!.seller).toBe(ADMIN)
    expect(ev!.price).toBe('1000000000')
    expect(ev!.currency).toBe(XLM_SAC)
    expect(ev!.royaltyPaid).toBe('100000000')  // 10% of 1 000 000 000
    expect(ev!.referralPaid).toBe('0')
    expect(ev!.feePaid).toBe('25000000')        // 2.5% of 1 000 000 000
  })

  it('ListingCreated listing_id=3: tokenId=5, same config', () => {
    const ev = findAll('ListingCreated').find(d => d.listingId === 3n)
    expect(ev, 'ListingCreated(3) missing').toBeDefined()
    expect(ev!.listingId).toBe(3n)
    expect(ev!.tokenId).toBe(5)
    expect(ev!.listingKind).toBe('fixed_price')
    expect(ev!.primarySplit).toBeNull()
  })

  it('ListingCancelled listing_id=3: seller=ADMIN', () => {
    const ev = findAll('ListingCancelled').find(d => d.listingId === 3n)
    expect(ev, 'ListingCancelled(3) missing').toBeDefined()
    expect(ev!.listingId).toBe(3n)
    expect(ev!.seller).toBe(ADMIN)
  })

  // ── integrity ───────────────────────────────────────────────────────────────

  it('OZ base mint events decode to Unknown with discriminant="mint"', () => {
    const mints = findAll('Unknown').filter(d => d.discriminant === 'mint')
    // One OZ mint per mint() call; we did 2 mints in the fixture
    expect(mints.length).toBe(2)
  })

  it('no unexpected Unknown events — all non-mint discriminants recognized', () => {
    const unexpected = findAll('Unknown').filter(d => d.discriminant !== 'mint')
    expect(unexpected).toHaveLength(0)
  })
})
