# Indexer Specification

Scope: the off-chain indexer described in `architecture.md §9`. The chain is the
source of truth; Supabase is a reconstructible projection. This document defines
the exact event catalog (extracted from source, not guessed), the Postgres schema,
the event→table mapping, and the two invariants the implementation must uphold.

---

## 1. Event catalog

Events are extracted verbatim from the contract sources. For each event the table
shows the Soroban wire encoding: `topics[0]` is always the discriminant Symbol;
subsequent topics are `#[topic]`-annotated fields; `data` is the tuple of remaining
fields.

### 1.1 ArtistRegistry (`contracts/artist-registry/src/lib.rs`)

#### `ArtistRegistered`

Emitted by `register()`.

| Position | Name | Type |
|----------|------|------|
| topics[0] | discriminant | Symbol `"artist_registered"` |
| topics[1] | artist | Address |
| data | *(empty)* | — |

#### `ArtistRevoked`

Emitted by `revoke()`.

| Position | Name | Type |
|----------|------|------|
| topics[0] | discriminant | Symbol `"artist_revoked"` |
| topics[1] | artist | Address |
| data | *(empty)* | — |

---

### 1.2 MolotovNft (`contracts/nft/src/lib.rs`)

#### `MintedEvent`

Custom event emitted by `mint()`, after the base sequential mint. Carries the
full royalty metadata; the indexer does not need to call `get_royalty_info` to
build the token record.

| Position | Name | Type | Note |
|----------|------|------|------|
| topics[0] | discriminant | Symbol `"minted_event"` | |
| topics[1] | token_id | u32 | sequential, starts at 0 |
| data[0] | artist | Address | |
| data[1] | recipient | Address | initial owner |
| data[2] | royalty_bps | u32 | total royalty in bps (100–1500) |
| data[3] | recipients_count | u32 | 1–10 |

`token_uri` is **not** in the event. The indexer must call `token_uri(token_id)`
on the NFT contract in the same poll cycle to hydrate the field.

#### `Transfer` (OZ SEP-50 base)

Emitted by every `transfer()` call, including marketplace escrow in/out and direct
user transfers. This is the primary source for `tokens.owner` updates.

| Position | Name | Type |
|----------|------|------|
| topics[0] | discriminant | Symbol `"transfer"` |
| topics[1] | from | Address |
| topics[2] | to | Address |
| data[0] | token_id | u32 |

#### `Burn` (OZ SEP-50 base)

Emitted by `burn()` and `burn_from()`.

| Position | Name | Type |
|----------|------|------|
| topics[0] | discriminant | Symbol `"burn"` |
| topics[1] | from | Address |
| data[0] | token_id | u32 |

---

### 1.3 Marketplace (`contracts/marketplace/src/lib.rs`)

#### `ListingCreated`

Emitted at the end of `list()`. Contains every field the indexer needs to
populate the listing row without a follow-up read.

| Position | Name | Type | Note |
|----------|------|------|------|
| topics[0] | discriminant | Symbol `"listing_created"` | |
| topics[1] | listing_id | u64 | monotonic counter from `NextListingId` |
| topics[2] | seller | Address | |
| data[0] | nft | Address | NFT contract address |
| data[1] | token_id | u32 | base token_id; OE uses [token_id, token_id+editions) |
| data[2] | price | i128 | per-unit price in stroops |
| data[3] | currency | Address | payment SAC |
| data[4] | kind | ListingKind | `FixedPrice \| OpenEdition \| Auction` |
| data[5] | editions_total | u32 | 1 for FixedPrice |
| data[6] | ends_at | u64 | unix seconds; 0 = no expiry |
| data[7] | referral_bps | u32 | |
| data[8] | primary_split | Option<Vec<{address,share_bps}>> | None = secondary sale |

#### `Sold`

Emitted at the end of `buy()`. `token_id` here is the **actual edition** sold
(for OpenEdition: `listing.token_id + editions_sold_before_this_sale`), not the
listing base token_id.

| Position | Name | Type | Note |
|----------|------|------|------|
| topics[0] | discriminant | Symbol `"sold"` | |
| topics[1] | listing_id | u64 | |
| topics[2] | token_id | u32 | specific edition transferred to buyer |
| data[0] | buyer | Address | |
| data[1] | seller | Address | original listing seller |
| data[2] | price | i128 | |
| data[3] | currency | Address | |
| data[4] | royalty_paid | i128 | 0 on primary sale |
| data[5] | referral_paid | i128 | 0 if no referrer or self-referral |
| data[6] | fee_paid | i128 | treasury + referral (gross platform take) |

Derived field: `treasury_amount = fee_paid − referral_paid`.

#### `ListingCancelled`

Emitted at the end of `cancel()`.

| Position | Name | Type |
|----------|------|------|
| topics[0] | discriminant | Symbol `"listing_cancelled"` |
| topics[1] | listing_id | u64 |
| topics[2] | seller | Address |
| data | *(empty)* | — |

---

## 2. Supabase projection schema

All monetary amounts are `NUMERIC(39,0)` (stroops as integers) to accommodate
`i128` without loss. `listing_id` is `BIGINT` (u64). `token_id` is `INTEGER`
(u32). Ledger numbers use `BIGINT` for headroom.

### 2.1 Migrations

```sql
-- 0001_artists.sql
CREATE TABLE artists (
  address                TEXT        PRIMARY KEY,
  registered_at_ledger   BIGINT      NOT NULL,
  registered_at_tx       TEXT        NOT NULL,
  registered_event_index INTEGER     NOT NULL,
  revoked                BOOLEAN     NOT NULL DEFAULT FALSE,
  revoked_at_ledger      BIGINT,
  revoked_at_tx          TEXT,
  revoked_event_index    INTEGER
);

-- 0002_tokens.sql
CREATE TABLE tokens (
  token_id              INTEGER     PRIMARY KEY,
  artist                TEXT        NOT NULL REFERENCES artists(address),
  owner                 TEXT        NOT NULL,
  token_uri             TEXT,
  royalty_bps           INTEGER     NOT NULL,
  recipients_count      INTEGER     NOT NULL,
  burned                BOOLEAN     NOT NULL DEFAULT FALSE,
  minted_at_ledger      BIGINT      NOT NULL,
  minted_at_tx          TEXT        NOT NULL,
  minted_event_index    INTEGER     NOT NULL
);

-- 0003_listings.sql
CREATE TABLE listings (
  listing_id            BIGINT      PRIMARY KEY,
  nft_contract          TEXT        NOT NULL,
  seller                TEXT        NOT NULL,
  token_id              INTEGER     NOT NULL REFERENCES tokens(token_id),
  price                 NUMERIC(39,0) NOT NULL,
  currency              TEXT        NOT NULL,
  kind                  TEXT        NOT NULL CHECK (kind IN ('fixed_price','open_edition','auction')),
  editions_total        INTEGER     NOT NULL,
  editions_sold         INTEGER     NOT NULL DEFAULT 0,
  ends_at               BIGINT      NOT NULL DEFAULT 0,
  referral_bps          INTEGER     NOT NULL,
  primary_split         JSONB,
  status                TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','sold','cancelled')),
  created_at_ledger     BIGINT      NOT NULL,
  created_at_tx         TEXT        NOT NULL,
  created_event_index   INTEGER     NOT NULL
);

-- 0004_sales.sql
CREATE TABLE sales (
  id                    BIGSERIAL   PRIMARY KEY,
  ledger                BIGINT      NOT NULL,
  tx_hash               TEXT        NOT NULL,
  event_index           INTEGER     NOT NULL,
  listing_id            BIGINT      NOT NULL REFERENCES listings(listing_id),
  token_id              INTEGER     NOT NULL,
  buyer                 TEXT        NOT NULL,
  seller                TEXT        NOT NULL,
  price                 NUMERIC(39,0) NOT NULL,
  currency              TEXT        NOT NULL,
  royalty_paid          NUMERIC(39,0) NOT NULL,
  referral_paid         NUMERIC(39,0) NOT NULL,
  fee_paid              NUMERIC(39,0) NOT NULL,
  UNIQUE (ledger, tx_hash, event_index)
);

-- 0005_token_transfers.sql
-- Full provenance log; drives the /work/[id] provenance tab.
CREATE TABLE token_transfers (
  id                    BIGSERIAL   PRIMARY KEY,
  ledger                BIGINT      NOT NULL,
  tx_hash               TEXT        NOT NULL,
  event_index           INTEGER     NOT NULL,
  token_id              INTEGER     NOT NULL,
  from_address          TEXT,
  to_address            TEXT,
  kind                  TEXT        NOT NULL CHECK (kind IN ('mint','transfer','burn')),
  UNIQUE (ledger, tx_hash, event_index)
);

-- 0006_indexer_cursor.sql
CREATE TABLE indexer_cursor (
  id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ledger BIGINT      NOT NULL DEFAULT 0,
  last_cursor TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO indexer_cursor (id, last_ledger) VALUES (1, 0);
```

### 2.2 Indexes

```sql
-- hot read paths
CREATE INDEX idx_tokens_artist   ON tokens (artist);
CREATE INDEX idx_tokens_owner    ON tokens (owner) WHERE NOT burned;
CREATE INDEX idx_listings_token  ON listings (token_id);
CREATE INDEX idx_listings_status ON listings (status) WHERE status = 'active';
CREATE INDEX idx_sales_token     ON sales (token_id);
CREATE INDEX idx_sales_buyer     ON sales (buyer);
CREATE INDEX idx_sales_seller    ON sales (seller);
CREATE INDEX idx_token_transfers_token ON token_transfers (token_id);
```

---

## 3. Event → table mapping

### Processing order within a ledger

Events within a transaction arrive in emission order. The indexer must apply them
in this exact order to ensure foreign key constraints are satisfied:

```
ArtistRegistered  →  artists (upsert)
ArtistRevoked     →  artists (update)
MintedEvent       →  tokens (insert), then call token_uri()
Transfer          →  tokens.owner (update), token_transfers (insert)
Burn              →  tokens.burned = true (update), token_transfers (insert)
ListingCreated    →  listings (insert)
Sold              →  sales (insert), listings.editions_sold++ + status (update)
ListingCancelled  →  listings.status = 'cancelled' (update)
```

### 3.1 ArtistRegistered → `artists`

```sql
INSERT INTO artists (
  address, registered_at_ledger, registered_at_tx, registered_event_index, revoked
) VALUES ($artist, $ledger, $tx_hash, $event_index, FALSE)
ON CONFLICT (address) DO UPDATE
  SET registered_at_ledger   = EXCLUDED.registered_at_ledger,
      registered_at_tx       = EXCLUDED.registered_at_tx,
      registered_event_index = EXCLUDED.registered_event_index,
      revoked                = FALSE,
      revoked_at_ledger      = NULL,
      revoked_at_tx          = NULL,
      revoked_event_index    = NULL;
```

### 3.2 ArtistRevoked → `artists`

```sql
UPDATE artists
   SET revoked              = TRUE,
       revoked_at_ledger    = $ledger,
       revoked_at_tx        = $tx_hash,
       revoked_event_index  = $event_index
 WHERE address = $artist;
```

### 3.3 MintedEvent → `tokens`

After insert, call `nft.token_uri($token_id)` and UPDATE `token_uri`.

```sql
INSERT INTO tokens (
  token_id, artist, owner, royalty_bps, recipients_count,
  minted_at_ledger, minted_at_tx, minted_event_index
) VALUES ($token_id, $artist, $recipient, $royalty_bps, $recipients_count,
          $ledger, $tx_hash, $event_index)
ON CONFLICT (token_id) DO NOTHING;
-- followed by: UPDATE tokens SET token_uri = $uri WHERE token_id = $token_id;
```

### 3.4 Transfer → `tokens` + `token_transfers`

```sql
UPDATE tokens SET owner = $to WHERE token_id = $token_id;

INSERT INTO token_transfers (ledger, tx_hash, event_index, token_id, from_address, to_address, kind)
VALUES ($ledger, $tx_hash, $event_index, $token_id, $from, $to, 'transfer')
ON CONFLICT DO NOTHING;
```

Note: during a `list()` call the Transfer moves the token from seller to the
marketplace contract address; during `buy()` it moves from marketplace to buyer;
during `cancel()` it moves from marketplace back to seller. All three update
`tokens.owner` to the correct address and produce a provenance entry.

### 3.5 Burn → `tokens` + `token_transfers`

```sql
UPDATE tokens SET burned = TRUE, owner = $from WHERE token_id = $token_id;

INSERT INTO token_transfers (ledger, tx_hash, event_index, token_id, from_address, to_address, kind)
VALUES ($ledger, $tx_hash, $event_index, $token_id, $from, NULL, 'burn')
ON CONFLICT DO NOTHING;
```

### 3.6 ListingCreated → `listings`

`primary_split` is stored as JSONB (array of `{address, share_bps}` objects);
`NULL` means secondary sale (royalty via NFT).

```sql
INSERT INTO listings (
  listing_id, nft_contract, seller, token_id, price, currency, kind,
  editions_total, ends_at, referral_bps, primary_split,
  created_at_ledger, created_at_tx, created_event_index
) VALUES (
  $listing_id, $nft, $seller, $token_id, $price, $currency, $kind,
  $editions_total, $ends_at, $referral_bps, $primary_split,
  $ledger, $tx_hash, $event_index
)
ON CONFLICT (listing_id) DO NOTHING;
```

### 3.7 Sold → `sales` + `listings`

`Sold.token_id` is the specific edition (may differ from `listings.token_id` for
OpenEdition). `editions_sold` increments by 1; status flips to `'sold'` once
`editions_sold = editions_total` (or immediately for FixedPrice).

**Idempotency constraint:** the `listings` UPDATE must only run if the `sales`
INSERT actually inserted a row. A naïve two-statement approach runs the UPDATE even
on a no-op conflict, double-counting `editions_sold` on replay. The fix ties the
UPDATE to the INSERT via a CTE:

```sql
WITH inserted AS (
  INSERT INTO sales (
    ledger, tx_hash, event_index,
    listing_id, token_id, buyer, seller, price, currency,
    royalty_paid, referral_paid, fee_paid
  )
  VALUES (
    $ledger, $tx_hash, $event_index,
    $listing_id, $token_id, $buyer, $seller, $price, $currency,
    $royalty_paid, $referral_paid, $fee_paid
  )
  ON CONFLICT DO NOTHING
  RETURNING listing_id
)
UPDATE listings l
   SET editions_sold = l.editions_sold + 1,
       status = CASE
         WHEN l.kind = 'fixed_price' THEN 'sold'
         WHEN l.editions_sold + 1 >= l.editions_total THEN 'sold'
         ELSE l.status
       END
  FROM inserted i
 WHERE l.listing_id = i.listing_id;
```

When the `ON CONFLICT DO NOTHING` fires (duplicate event), the CTE `inserted`
returns zero rows, the `FROM inserted` join matches nothing, and the UPDATE is a
no-op. `editions_sold` stays correct regardless of how many times the event is
applied.

### 3.8 ListingCancelled → `listings`

```sql
UPDATE listings SET status = 'cancelled' WHERE listing_id = $listing_id;
```

---

### 3.9 Effective owner (view)

The on-chain `owner` of an escrowed token is the marketplace contract address, not
the seller. For display (browse, profiles, work page), the app needs the *human*
owner: the seller while the token is actively listed, the actual `tokens.owner`
otherwise.

```sql
CREATE VIEW token_effective_owner AS
SELECT
  t.*,
  COALESCE(
    (
      SELECT l.seller
        FROM listings l
       WHERE l.status = 'active'
         AND t.token_id >= l.token_id + l.editions_sold
         AND t.token_id <  l.token_id + l.editions_total
       LIMIT 1
    ),
    t.owner
  ) AS effective_owner,
  (
    SELECT l.listing_id
      FROM listings l
     WHERE l.status = 'active'
       AND t.token_id >= l.token_id + l.editions_sold
       AND t.token_id <  l.token_id + l.editions_total
     LIMIT 1
  ) AS active_listing_id
FROM tokens t;
```

**Range condition:** `t.token_id >= l.token_id + l.editions_sold` anchors the
left bound to the *next unsold* edition. Each `Sold` event increments
`editions_sold`, sliding this bound rightward. A token whose index has been
consumed by a sale (owner = buyer) no longer satisfies the condition, so
`COALESCE` falls back to `t.owner` (the buyer). Non-listed tokens similarly fall
back. The view is correct for FixedPrice (range is exactly one token) and for
OpenEdition mid-sellthrough.

---

## 4. Invariants

### 4.1 Reconstructability

> Replaying all events from the deploy ledger of the earliest contract to the
> current tip, applying them in `(ledger, tx_hash, event_index)` order, produces
> the same Supabase state as the live projection.

Corollaries:
- No state lives solely in Supabase; every row is derivable from on-chain events.
- `token_uri` requires a follow-up RPC read but is deterministic (the value written
  at mint never changes; `set_default_royalty` and `set_token_royalty` panic).
- Collections and profile metadata (free-text bio, handle, links) are the only
  off-chain data; they sit outside the projection tables and are not reconstructed
  from chain.

To rebuild from scratch: truncate all projection tables (excluding `collections`
and profile metadata), reset `indexer_cursor.last_ledger` to the deploy ledger,
re-run the poller.

### 4.2 Idempotency

> Applying the same event (same `ledger`, `tx_hash`, `event_index`) twice produces
> the same database state as applying it once.

Mechanisms per table:

| Table | Mechanism |
|-------|-----------|
| `artists` | `ON CONFLICT (address) DO UPDATE` sets fields to the same values |
| `tokens` | `ON CONFLICT (token_id) DO NOTHING`; `token_uri` UPDATE is safe to repeat |
| `token_transfers` | `UNIQUE (ledger, tx_hash, event_index)` + `ON CONFLICT DO NOTHING` |
| `listings` | `ON CONFLICT (listing_id) DO NOTHING` for insert; updates are idempotent because `Sold`/`ListingCancelled` only ever push status forward |
| `sales` | `UNIQUE (ledger, tx_hash, event_index)` + `ON CONFLICT DO NOTHING` |

The `listings.editions_sold` increment is the only non-trivially idempotent
mutation. The Sold event's `UNIQUE` constraint on `(ledger, tx_hash, event_index)`
prevents double-insertion into `sales`; the corresponding `listings` UPDATE
therefore only runs once per sale event.

---

## 5. Row-level security

### 5.1 Policy matrix

| Table | anon SELECT | anon INSERT/UPDATE/DELETE | service_role |
|-------|-------------|--------------------------|--------------|
| `artists` | ✓ | ✗ | ✓ (bypasses RLS) |
| `tokens` | ✓ | ✗ | ✓ |
| `listings` | ✓ | ✗ | ✓ |
| `sales` | ✓ | ✗ | ✓ |
| `token_transfers` | ✓ | ✗ | ✓ |
| `indexer_cursor` | ✗ | ✗ | ✓ |

The `token_effective_owner` view inherits the `tokens` and `listings` policies:
anon can SELECT from the view.

### 5.2 Indexer authentication

The poller runs server-side and connects with `SUPABASE_SERVICE_ROLE_KEY` (env var,
gitignored). The `service_role` JWT bypasses RLS natively — no superuser grant
needed. The anon key is **never** given write access to any projection table.

### 5.3 Indexer functions (`apply_*`)

The event-handler Postgres functions (`apply_sold`, etc.) are `SECURITY DEFINER`
and `REVOKE EXECUTE … FROM anon, authenticated`. Even if an attacker somehow
obtained the anon key, they cannot call these functions or write to any table.

---

## 7. Cursor and polling strategy

The indexer advances `indexer_cursor.last_ledger` atomically with each batch of
events via a Postgres transaction:

```
BEGIN;
  -- apply all events from this batch to projection tables
  UPDATE indexer_cursor SET last_ledger = $next_ledger, last_cursor = $cursor, updated_at = now() WHERE id = 1;
COMMIT;
```

If the worker dies mid-batch, the cursor is not advanced; the next run re-fetches
the same ledger range and idempotency guarantees correctness.

Poll target: `getEvents` for all three contract IDs, paged by cursor, from
`last_ledger` to `ledger_tip`. Ledger tip is obtained from the same RPC call's
`latestLedger` field.

### 7.1 Retention window

The Soroban public RPC retains events for approximately **7 days** (~120 000
ledgers at 5 s/ledger). This has two consequences:

1. **The indexer must run continuously.** Any outage longer than ~7 days causes
   an unrecoverable gap in event history: `getEvents` will no longer return
   events from before the window, and §4.1's "replay from the deploy ledger"
   invariant cannot be satisfied with the public RPC alone.

2. **Full-history replay requires an archive source.** To rebuild the
   projection from the deploy ledger after a gap, use an archival event feed
   (e.g. Stellar Horizon event streaming, Mercury, or a self-hosted node with
   full history) instead of `getEvents`. The event→table mapping (§3) remains
   identical regardless of source; only the cursor and fetch loop change.

---

## 8. Events not indexed (and why)

| Event | Reason |
|-------|--------|
| OZ base `Mint` (topics: `["mint", to]`, data: `[token_id]`) | Superseded by `MintedEvent`, which carries richer data in the same tx |
| Ownable transfer events (`OwnershipTransfer`, `OwnershipTransferCompleted`, `OwnershipRenounced`) | Admin-only ops; no user-visible projection needed in v1 |
| `Auction` kind | `buy()` panics `NotImplemented`; no Sold events will appear for Auction listings until the upgrade |
| `set_allowed_currency` | No event defined on the contract; admin op tracked off-chain if needed |

---

## 9. Open questions (not blocking v1)

| Question | Impact |
|----------|--------|
| Multi-wallet secondary split | `Sold` emits one `royalty_paid` total; breakdown per recipient requires parsing the `Transfer` events in the same tx, or a later contract upgrade that emits per-recipient rows |
| `token_uri` hydration failure | If the RPC call fails, `tokens.token_uri` stays NULL; the poller should retry and the UI should handle null gracefully |
| Mercury/Zephyr alternative | If Mercury replaces the hand-rolled poller, the event→table mapping (§3) stays identical; only the cursor and polling loop change |
