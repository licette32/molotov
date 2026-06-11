# Marketplace — Money-Conservation Invariants & Property-Test Spec

Lock the distribution semantics of `buy(buyer, listing_id, referrer)` **before** the
logic is written. Every property below is a test (prefer property-based / fuzz over
fixed cases) and must be green before `buy()` is considered done.

All amounts are stroops (`i128`, 1 XLM = 10⁷). All arithmetic uses `checked_*`.
The marketplace **never custodies funds** — it orchestrates buyer→recipient transfers
and must hold a zero balance after every sale.

---

## Definitions

- `P` = sale price (stroops, `P > 0`)
- `fee_bps`, `referral_bps`, `royalty_bps` are basis points (`10000 = 100%`)
- `fee = P * fee_bps / 10000` — the **total** platform fee (objkt-style: 5% → `fee_bps = 500`)
- `referral = referrer.is_some() ? P * referral_bps / 10000 : 0`

### Decision locked (mirrors objkt, the reference the artist gave us)
- `fee`, `referral` and `royalty` are all computed on **gross `P`** — never on a net base.
- **`referral` is carved OUT of `fee`, not added on top.** The seller always pays a flat
  `fee`, whether or not the sale was referred. On a referred sale the treasury keeps
  `fee − referral` and the referrer receives `referral`. Constraint: `referral_bps ≤ fee_bps`.

So the platform side of every sale is exactly `fee`, split as:
- treasury ← `fee − referral`
- referrer ← `referral`  (0 when there's no referrer → treasury gets the full `fee`)

Two mutually exclusive paths, fixed at `list` time:

- **Secondary** (`primary_split == None`): royalty via
  `nft.get_royalty_info(token_id, P)` → `Vec<(addr, amt)>`, with sum `R`.
  `remainder = P − fee − R` → single seller wallet (v1).
- **Primary** (`primary_split == Some(splits)`): `distributable = P − fee`;
  split across `N` wallets (`N ≤ 10`) by `share_bps` (Σ `share_bps = 10000`),
  **last wallet absorbs the dust**.

---

## THE master invariant (conservation)

For every valid `buy`, the sum of all outgoing transfers equals `P` **exactly** — not
±1 stroop, no stroop created or destroyed:

```
Secondary:  (fee − referral) + referral + R + remainder == P     // remainder = P − fee − R
Primary:    (fee − referral) + referral + Σsplit        == P     // Σsplit   = P − fee
```

`(fee − referral)` → treasury, `referral` → referrer. With no referrer, `referral = 0`
and the treasury receives the full `fee`. The platform's total take is always exactly
`fee`, never more on a referred sale.

After the buy, the marketplace's own balance is **0**.

---

## Properties (each one is a test)

**Conservation**
1. `P1` Secondary — random `P, fee_bps, referral_bps`, valid royalty config, with and
   without referrer → `(fee − referral) + referral + R + remainder == P`,
   where `remainder = P − fee − R`.
2. `P2` Primary — random `P, fee_bps, referral_bps`, random valid split (1..=10 wallets,
   `share_bps` summing to 10000) → `(fee − referral) + referral + Σsplit == P`,
   where `Σsplit = P − fee`.
3. `P3` Marketplace residual balance `== 0` after buy (both paths).

**Fee / referral split (referral comes OUT of the fee)**
4. `P4` Treasury receives exactly `fee − referral`; the referrer receives exactly
   `referral`. With no referrer, treasury receives the full `fee` and nobody else is paid
   on the platform side.
5. `P5` Seller cost is invariant to referral: for fixed `P, fee_bps, royalty`, the
   seller's remainder is identical whether or not the sale was referred — the referral
   only re-routes money **inside** `fee`.

**Dust / rounding**
6. `P6` Primary split: the **last** recipient gets exactly
   `distributable − Σ(other shares)`. Dust lands on the last wallet — never lost,
   never duplicated.
7. `P7` The marketplace pays exactly the vector `get_royalty_info` returns; its sum
   equals the royalty total the NFT computed (cross-checks the NFT's own dust handling).
8. `P8` Determinism — re-deriving shares from identical inputs yields identical amounts.

**Non-negativity & bounds**
9. `P9` `remainder >= 0` always. Guard (enforced at `list`, re-checked at `buy`):
   `referral_bps ≤ fee_bps` **and** `fee_bps + royalty_bps ≤ 10000`. Violations are
   rejected, never allowed to underflow.
10. `P10` Every individual payout `>= 0`.
11. `P11` Recipient/split list never exceeds `MAX_RECIPIENTS = 10` (reject otherwise).

**Overflow safety**
12. `P12` With `P` near `i128::MAX / 10000`, every `* bps / 10000` is
    `checked_mul`/`checked_div`; overflow returns a clean error, never wraps. Fuzz
    extreme `P`.

**State ordering & auth (co-pass with the money tests)**
13. `P13` Checks-effects-interactions — listing marked sold/removed **before** any
    transfer; a re-entrant `buy` on the same listing fails.
14. `P14` Payment currency must be in the allowlist; a buy in a non-allowlisted SAC is
    rejected.
15. `P15` Self-referral — decision: if `referrer == buyer` or `referrer == seller`,
    `referral = 0`; the treasury keeps the full fee; the sale still goes through.
    (Tested in `buy` for both the buyer and the seller case.)
16. `P16` `Auction` listing kind → `buy` panics `NotImplemented` (reserved, never
    silently mishandled).

**Zero / degenerate**
17. `P17` `fee_bps = 0` ⟹ `referral_bps = 0` (can't carve a referral from a zero fee);
    single-wallet primary split, no referrer → the wallet receives exactly `P`.
18. `P18` One royalty recipient at full `royalty_bps` → recipient + seller remainder
    still sum to `P`.

---

## Generator coverage (the fuzz space)

- `P`: `1` .. very large — **include tiny values (1, 2, 3)** where integer-division dust
  is most visible.
- `fee_bps`: 0..~1000 · `referral_bps`: `0..=fee_bps` (referral is carved from the fee) ·
  `royalty_bps`: 100..1500 (the NFT's `MIN`/`MAX`).
- split wallets: 1..10, with `share_bps` partitions that **don't divide evenly** (force
  dust onto the last wallet).
- referrer: `None` / `Some(random)` / `Some(buyer)` / `Some(seller)`.
- both modes: primary `Some` / secondary `None`.

---

## Build order (hand this to the agent)

1. Define distribution as a **pure function**, e.g.
   `fn distribute(price, fee_bps, referral_bps, referrer, mode) -> Vec<(Address, i128)>`,
   separate from escrow/transfer logic.
2. Write `P1`–`P18` against that pure function **first** (property-based where marked).
   Green here = the money math is sound in isolation.
3. **Then** wire escrow + `token.transfer` + auth into `buy()`, reusing the pure
   function. `P3`, `P13`, `P14`, `P16` become testable on the full contract.
4. Only after all green: `cancel`, open-edition sell-through, and the events the indexer
   needs (`ListingCreated`, `Sold`, `ListingCancelled`).

> The whole pitch ("the contract enforces the royalty, not the platform") rests on the
> conservation invariant. If the money doesn't close to the stroop, nothing else matters.
