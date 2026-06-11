# Contratos Molotov

Registro de contratos Soroban desplegados y cómo reproducir cada deploy.

## Entorno

| Herramienta | Versión |
|---|---|
| Rust | 1.93.0 |
| Target WASM | `wasm32v1-none` |
| Stellar CLI | 25.2.0 |
| soroban-sdk | 25.3.0 |
| OpenZeppelin Stellar (`stellar-tokens` / `stellar-access` / `stellar-macros`) | 0.7.1 |

Workspace Rust en `contracts/` (`contracts/Cargo.toml`). Cada contrato es un crate
miembro (`contracts/nft`, …).

### Cuenta de deploy (testnet)

- Alias CLI: `molotov-dev`
- Address: `GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM`

Regenerar / refondear:

```bash
stellar keys generate molotov-dev --network testnet --fund
```

---

## MolotovNFT (producción — Paso 6)

Contrato NFT de producción. Reemplaza el scaffold del Paso 4. Implementa los
tres diferenciales del producto:

1. **Royalties inmutables**: la config de royalty se fija en el minteo y no
   puede modificarse nunca. No hay setters; los stubs `set_default_royalty` /
   `set_token_royalty` panickean con `RoyaltiesImmutableAfterMint`.
2. **Split multi-wallet**: el royalty se reparte entre N destinatarios, cada uno
   con su porción en bps (la suma debe ser 10000).
3. **Mint gated por ArtistRegistry** (cross-contract). Hasta el Paso 7 el
   registry es un placeholder que desactiva el gate (ver decisiones).

Base SEP-50 (transfer/burn/owner_of/balance/token_uri) de OpenZeppelin
(`ContractType = Base`); `token_uri` se sobreescribe para servir URIs IPFS por
token. Acceso: `Ownable` (admin = owner) **sólo** para upgrades/treasury, nunca
para royalties.

### Deploy actual (testnet)

| Campo | Valor |
|---|---|
| Network | TESTNET (`Test SDF Network ; September 2015`) |
| Contract ID | `CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS` |
| WASM hash | `f67053ba9957714ff9b58bef1046c1286ae49ed30568df50d76a5ddef083ad87` |
| Admin/Owner | `GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM` |
| Registry | `CC37LTUP…U533` (real ArtistRegistry → gate **ON**; was the all-zeros placeholder, wired via `set_registry` — see ArtistRegistry below) |
| Metadata | name `Molotov` · symbol `MOLO` |

> Redeploy de la Fase 0 (cap de recipients + `set_registry` + `upgrade`). El
> deploy anterior `CCRGD3F…FMT4` queda obsoleto.
>
> Upgrade in-place a la Fase 0.5 (extensión de TTL de las entries persistentes
> royalty/URI). El contract ID **no cambió**; el WASM pasó de `34f38178…eebb9` a
> `f67053ba…83ad87`. Txs: upload `591097f3b436ce063d5c3a72dc7d85cf1ce8c6ef8a1d4a55baba64f7205fb406`,
> upgrade `6c81bb426ee16d11d8a269835d4a486d4e15a6752382452c2090c4473763ea29`.
> TTL de Fase 0.5 activo (mint y `get_royalty_info` bumpean a ~30 días).

Explorer: <https://stellar.expert/explorer/testnet/contract/CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS>

Bindings TS: `packages/stellar-client/src/molotov-nft/` (sha256 `src/index.ts`:
`9fb6af4a98aeaf509af17001b967f78b4fdfca8c5aed6b37213833edb49ae902`).

### Decisiones técnicas

- **Registry gate (now active):** the artist gate is a cross-contract call
  `ArtistRegistryClient::is_registered(artist)`. The NFT shipped pointing at the
  all-zeros placeholder `TEMP_REGISTRY_PLACEHOLDER` (`CAAAA…BSC4`), which
  **disables** the gate. The real ArtistRegistry is now deployed and wired in
  place via `set_registry` (owner-gated, no NFT redeploy needed): the gate is
  **ON** — only registered artists can mint. See the ArtistRegistry section below.
- **Royalty math:** `total = sale_price * total_bps / 10000`; cada porción
  `total * share_bps / 10000`. El **último** destinatario absorbe el dust de
  redondeo para que la suma cierre exacto. Todas las multiplicaciones usan
  `checked_mul`/`checked_div` (panic `MathOverflow`).
- **token_uri por token:** la base de OZ arma `base_uri + id`; se sobreescribe
  para devolver la URI IPFS guardada en storage al mintear.
- **Eventos:** `MintedEvent` vía `#[contractevent]` (topic `token_id` + data
  `artist, recipient, royalty_bps, recipients_count`). Verificado en vivo.

### Reproducir el deploy

Desde `contracts/`:

```bash
cargo test                 # 18 tests, todos verdes
stellar contract build     # -> target/wasm32v1-none/release/molotov_nft.wasm

ADMIN=$(stellar keys address molotov-dev)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/molotov_nft.wasm \
  --source molotov-dev --network testnet \
  -- \
  --admin "$ADMIN" \
  --registry "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" \
  --name "Molotov" --symbol "MOLO"
```

### Smoke test en vivo (verificado)

```bash
ID=CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS
ADMIN=$(stellar keys address molotov-dev)

# mint 10% royalty, 1 recipient (100%)
stellar contract invoke --id $ID --source molotov-dev --network testnet -- mint \
  --artist "$ADMIN" --recipient "$ADMIN" --token_uri "ipfs://smoke-test-obra" \
  --royalty_bps 1000 --recipients "[{\"address\":\"$ADMIN\",\"share_bps\":10000}]"
# -> token_id 0, evento MintedEvent emitido

stellar contract invoke --id $ID --source molotov-dev --network testnet -- \
  get_royalty_info --token_id 0 --sale_price 10000000
# -> [["G…","1000000"]]  (10% de 10.000.000 stroops)
```

### Tests (`cargo test` — 18/18 verdes)

| # | Test | Resultado |
|---|---|---|
| 1 | `test_mint_with_valid_royalty` (10%, 1 recipient, storage) | ✅ |
| 2 | `test_mint_with_royalty_split` (12%, 5000/3000/2000, montos) | ✅ |
| 3 | `test_transfer` (artist → a → b) | ✅ |
| 4 | `test_burn` (owner quema; owner_of falla después) | ✅ |
| 5 | `test_mint_rejects_royalty_below_min` (99 bps → panic) | ✅ |
| 6 | `test_mint_rejects_royalty_above_max` (1501 bps → panic) | ✅ |
| 7 | `test_mint_rejects_split_not_summing_10000` (panic) | ✅ |
| 8 | `test_mint_rejects_unregistered_artist` (registry mock → panic) | ✅ |
| 9a | `test_set_default_royalty_is_immutable` (panic) | ✅ |
| 9b | `test_set_token_royalty_is_immutable` (panic) | ✅ |
| 10 | `test_burn_by_non_owner_fails` (panic) | ✅ |
| + | `test_mint_accepts_registered_artist` (gate deja pasar) | ✅ |

Phase 0 additions:

| # | Test | Result |
|---|---|---|
| 11 | `test_mint_accepts_exactly_max_recipients` (10 recipients, the cap) | ✅ |
| 12 | `test_mint_rejects_more_than_max_recipients` (11 → panic `TooManyRecipients`) | ✅ |
| 13 | `test_set_registry_updates_value` (owner repoints; `registry()` reflects it) | ✅ |
| 14 | `test_set_registry_requires_owner_auth` (no auth → panic) | ✅ |
| 15 | `test_set_registry_activates_gate` (placeholder → deny → allow rewires the gate) | ✅ |
| 16 | `test_upgrade_requires_owner_auth` (no auth → panic before WASM swap) | ✅ |

> Nota: el evento `MintedEvent` se verifica **en vivo** (smoke test), no en unit
> tests — el env de soroban-sdk 25.3 no surfacea eventos vía `events().all()`.

### Scaffold previo (Paso 4 — reemplazado)

El scaffold del Paso 4 (`CB3OUQ…CRJLA2`, royalties mutables vía extensión OZ)
queda obsoleto y reemplazado por este contrato.

---

## ArtistRegistry (the minting gate — Phase 1)

Admin-curated allowlist of the artists allowed to mint on `MolotovNft`. The NFT
calls `is_registered(artist)` cross-contract before every mint; only the contract
owner (admin / curator) can `register` or `revoke`. Access mirrors the NFT
exactly: a single owner set at construction (`stellar-access` Ownable),
privileged calls gated by `enforce_owner_auth`. Registration state is a per-artist
persistent flag, kept alive with the same ~30-day TTL discipline the NFT uses for
its royalty/URI entries (`register` and a registered-read both bump the TTL;
`revoke` removes the entry to free rent).

Surface (architecture.md §5.2): `__constructor(admin)`, `register(artist)`,
`revoke(artist)`, `is_registered(artist) -> bool`, `upgrade(new_wasm_hash)`.
Events `ArtistRegistered` / `ArtistRevoked` (topic `artist`).

### Deploy actual (testnet)

| Campo | Valor |
|---|---|
| Network | TESTNET (`Test SDF Network ; September 2015`) |
| Contract ID | `CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533` |
| WASM hash | `6953b5496801e8b103947bde2ed05f0f01f75ac0bdbaa92e8c60481a1b2bd3fa` |
| Admin/Owner | `GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM` |

Explorer: <https://stellar.expert/explorer/testnet/contract/CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533>

> The NFT gate is wired to this registry via `set_registry` (no NFT redeploy):
> `NFT.registry()` returns `CC37LTUP…U533`, gate **ON**.

### Reproducir el deploy

Desde `contracts/`:

```bash
cargo test -p molotov-artist-registry   # 10 tests, all green
stellar contract build                  # -> target/wasm32v1-none/release/molotov_artist_registry.wasm

ADMIN=$(stellar keys address molotov-dev)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/molotov_artist_registry.wasm \
  --source molotov-dev --network testnet \
  -- \
  --admin "$ADMIN"

# Wire the NFT gate to the real registry (owner-gated, in place):
NFT=CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS
REGISTRY=CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533
stellar contract invoke --id $NFT --source molotov-dev --network testnet -- \
  set_registry --new_registry $REGISTRY
```

### Smoke test en vivo (verificado)

End-to-end gate cycle against the live NFT (`CBS6UQE…7XWS`):

```
1. is_registered(admin)  -> false
2. mint (unregistered)   -> FAIL  Error(Contract, #6) ArtistNotRegistered  (gate denies)
3. register(admin)       -> event ArtistRegistered
4. is_registered(admin)  -> true
5. mint (registered)     -> token_id 1, event MintedEvent                  (gate allows)
6. revoke(admin)         -> event ArtistRevoked
7. is_registered(admin)  -> false
8. mint (revoked)        -> FAIL  Error(Contract, #6) ArtistNotRegistered  (gate denies)
```

> After the smoke test the dev account was re-registered, so testnet minting works
> for the next phase (Marketplace).

### Tests (`cargo test -p molotov-artist-registry` — 10/10 verdes)

| # | Test | Result |
|---|---|---|
| 1 | `test_unregistered_artist_reads_false` (fresh registry, no panic) | ✅ |
| 2 | `test_register_marks_artist` (owner registers; reflected) | ✅ |
| 3 | `test_register_is_idempotent` (double register stays registered) | ✅ |
| 4 | `test_register_is_scoped_per_artist` (one artist ≠ another) | ✅ |
| 5 | `test_register_requires_owner_auth` (no auth → panic) | ✅ |
| 6 | `test_revoke_clears_artist` (register → revoke → false) | ✅ |
| 7 | `test_revoke_unregistered_is_noop` (revoke unknown stays false) | ✅ |
| 8 | `test_revoke_requires_owner_auth` (no auth → panic) | ✅ |
| 9 | `test_upgrade_requires_owner_auth` (no auth → panic before WASM swap) | ✅ |
| 10 | `test_register_and_read_extend_persistent_ttl` (register + read bump TTL) | ✅ |

> Same caveat as the NFT: `ArtistRegistered` / `ArtistRevoked` events are verified
> **live** (smoke test), not in unit tests — soroban-sdk 25.3's test env does not
> surface contract events via `events().all()`.
