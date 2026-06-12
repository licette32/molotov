/**
 * XDR → native JS decoder for each Molotov contract event.
 *
 * Encoding in soroban-sdk 25.3 with #[contractevent]:
 *   topics[0]   = Symbol  (struct name in snake_case, e.g. MintedEvent → "minted_event")
 *   topics[1..] = #[topic] fields in declaration order
 *   value       = ScvMap with field names as keys (not a positional Vec)
 *
 * SEP-50 OZ events (transfer / burn):
 *   topics = [Symbol, from: Address, (to: Address)?]
 *   value  = ScvMap({ token_id: u32 })
 *
 * Unit enums (#[contracttype]) encode as ScvVec([ScvSymbol("VariantName")]).
 * scValToNative turns that into ["VariantName"].
 *
 * Option::None encodes as ScvVoid → scValToNative → null.
 * Option::Some(v) encodes as v directly.
 */

import { xdr, scValToNative, rpc } from '@stellar/stellar-sdk'

// ── low-level helpers ─────────────────────────────────────────────────────────

/** Symbol ScVal → string */
const sym = (v: xdr.ScVal): string => v.sym().toString()

/** Any ScVal → native JS value */
const nat = (v: xdr.ScVal) => scValToNative(v)

/** ScVal → bech32 address string */
const addr = (v: xdr.ScVal): string => nat(v) as string

/** ScVal → number (u32) */
const u32n = (v: xdr.ScVal): number => nat(v) as number

/** ScVal → bigint (u64) */
const u64n = (v: xdr.ScVal): bigint => nat(v) as bigint

// ── application-level helpers ─────────────────────────────────────────────────

/** Unit enum ["FixedPrice"] or "FixedPrice" → snake_case db tag */
function kindToDb(raw: unknown): 'fixed_price' | 'open_edition' | 'auction' {
  const tag = Array.isArray(raw) ? (raw[0] as string) : (raw as string)
  switch (tag) {
    case 'FixedPrice':  return 'fixed_price'
    case 'OpenEdition': return 'open_edition'
    default:            return 'auction'
  }
}

/**
 * Option<Vec<RoyaltyRecipient>> → null or [{address, share_bps}]
 * None  = ScvVoid → null after scValToNative
 * Some  = ScvVec of ScvMap({ address, share_bps })
 */
function decodePrimarySplit(
  raw: unknown,
): { address: string; share_bps: number }[] | null {
  if (raw == null) return null
  return raw as { address: string; share_bps: number }[]
}

// ── discriminated union of decoded events ─────────────────────────────────────

export type DecodedEvent =
  | { kind: 'ArtistRegistered'; artist: string }
  | { kind: 'ArtistRevoked'; artist: string }
  | {
      kind: 'MintedEvent'
      tokenId: number
      artist: string
      recipient: string
      royaltyBps: number
      recipientsCount: number
    }
  | { kind: 'Transfer'; tokenId: number; from: string; to: string }
  | { kind: 'Burn'; tokenId: number; from: string }
  | {
      kind: 'ListingCreated'
      listingId: bigint
      seller: string
      nft: string
      tokenId: number
      price: string
      currency: string
      listingKind: 'fixed_price' | 'open_edition' | 'auction'
      editionsTotal: number
      endsAt: bigint
      referralBps: number
      primarySplit: { address: string; share_bps: number }[] | null
    }
  | {
      kind: 'Sold'
      listingId: bigint
      tokenId: number
      buyer: string
      seller: string
      price: string
      currency: string
      royaltyPaid: string
      referralPaid: string
      feePaid: string
    }
  | { kind: 'ListingCancelled'; listingId: bigint; seller: string }
  | { kind: 'Unknown'; discriminant: string }

// ── main decoder ──────────────────────────────────────────────────────────────

export function decodeEvent(event: rpc.Api.EventResponse): DecodedEvent {
  const t = event.topic
  if (!t.length) return { kind: 'Unknown', discriminant: '(empty topics)' }

  const disc = sym(t[0])

  switch (disc) {
    // ── ArtistRegistry ────────────────────────────────────────────────────────
    case 'artist_registered':
      return { kind: 'ArtistRegistered', artist: addr(t[1]) }

    case 'artist_revoked':
      return { kind: 'ArtistRevoked', artist: addr(t[1]) }

    // ── MolotovNft ────────────────────────────────────────────────────────────
    case 'minted_event': {
      const d = nat(event.value) as {
        artist: string
        recipient: string
        royalty_bps: number
        recipients_count: number
      }
      return {
        kind: 'MintedEvent',
        tokenId: u32n(t[1]),
        artist: d.artist,
        recipient: d.recipient,
        royaltyBps: d.royalty_bps,
        recipientsCount: d.recipients_count,
      }
    }

    // SEP-50: topics = [Symbol("transfer"), from, to], value = Map({token_id})
    case 'transfer': {
      const d = nat(event.value) as { token_id: number }
      return {
        kind: 'Transfer',
        from: addr(t[1]),
        to: addr(t[2]),
        tokenId: d.token_id,
      }
    }

    // SEP-50: topics = [Symbol("burn"), from], value = Map({token_id})
    case 'burn': {
      const d = nat(event.value) as { token_id: number }
      return {
        kind: 'Burn',
        from: addr(t[1]),
        tokenId: d.token_id,
      }
    }

    // ── Marketplace ───────────────────────────────────────────────────────────

    // topics[1] = listing_id (u64), topics[2] = seller (Address)
    // value Map = {nft, token_id, price, currency, kind, editions_total, ends_at, referral_bps, primary_split}
    case 'listing_created': {
      const d = nat(event.value) as {
        nft: string
        token_id: number
        price: bigint
        currency: string
        kind: unknown
        editions_total: number
        ends_at: bigint
        referral_bps: number
        primary_split: unknown
      }
      return {
        kind: 'ListingCreated',
        listingId: u64n(t[1]),
        seller: addr(t[2]),
        nft: d.nft,
        tokenId: d.token_id,
        price: String(d.price),
        currency: d.currency,
        listingKind: kindToDb(d.kind),
        editionsTotal: d.editions_total,
        endsAt: d.ends_at,
        referralBps: d.referral_bps,
        primarySplit: decodePrimarySplit(d.primary_split),
      }
    }

    // topics[1] = listing_id (u64), topics[2] = token_id (u32)
    // value Map = {buyer, seller, price, currency, royalty_paid, referral_paid, fee_paid}
    case 'sold': {
      const d = nat(event.value) as {
        buyer: string
        seller: string
        price: bigint
        currency: string
        royalty_paid: bigint
        referral_paid: bigint
        fee_paid: bigint
      }
      return {
        kind: 'Sold',
        listingId: u64n(t[1]),
        tokenId: u32n(t[2]),
        buyer: d.buyer,
        seller: d.seller,
        price: String(d.price),
        currency: d.currency,
        royaltyPaid: String(d.royalty_paid),
        referralPaid: String(d.referral_paid),
        feePaid: String(d.fee_paid),
      }
    }

    // topics[1] = listing_id (u64), topics[2] = seller (Address)
    // value = ScvMap({}) — no non-topic fields
    case 'listing_cancelled':
      return {
        kind: 'ListingCancelled',
        listingId: u64n(t[1]),
        seller: addr(t[2]),
      }

    default:
      // mint (SEP-50 OZ mint — covered by minted_event), approve, etc.
      return { kind: 'Unknown', discriminant: disc }
  }
}
