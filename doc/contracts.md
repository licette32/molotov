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
| Contract ID | `CCRGD3FAIZY4VRP55QFMFFSSAEKYMZE7LB5EF6OXPVYVYNVXEC7UFMT4` |
| WASM hash | `9996e8c52d511adfc9087eff7c7f0a009b55f2d5cc7038c62d60339063b95723` |
| Admin/Owner | `GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM` |
| Registry | `CAAAA…BSC4` (placeholder all-zeros → gate OFF hasta Paso 7) |
| Metadata | name `Molotov` · symbol `MOLO` |

Explorer: <https://stellar.expert/explorer/testnet/contract/CCRGD3FAIZY4VRP55QFMFFSSAEKYMZE7LB5EF6OXPVYVYNVXEC7UFMT4>

Bindings TS: `packages/stellar-client/src/molotov-nft/` (sha256 `src/index.ts`:
`e9d95adacb034a9dfea2279cbef3ec38f8e5cb3742768d6aca1df5fbd68f572b`).

### Decisiones técnicas

- **Mock del Registry (a revisar para Paso 7):** el gate de artistas es una
  llamada cross-contract `ArtistRegistryClient::is_registered(artist)`. Mientras
  el registry sea el placeholder `TEMP_REGISTRY_PLACEHOLDER`
  (`CAAAA…BSC4`, contract id all-zeros), el gate se **desactiva** (mint abierto).
  En el Paso 7 se deploya el ArtistRegistry real y se redeploya el NFT pasándolo
  como `--registry`; ahí el gate queda activo. La interfaz ya está lista
  (`#[contractclient(name = "ArtistRegistryClient")]`).
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
cargo test                 # 12 tests, todos verdes
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
ID=CCRGD3FAIZY4VRP55QFMFFSSAEKYMZE7LB5EF6OXPVYVYNVXEC7UFMT4
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

### Tests (`cargo test` — 12/12 verdes)

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

> Nota: el evento `MintedEvent` se verifica **en vivo** (smoke test), no en unit
> tests — el env de soroban-sdk 25.3 no surfacea eventos vía `events().all()`.

### Scaffold previo (Paso 4 — reemplazado)

El scaffold del Paso 4 (`CB3OUQ…CRJLA2`, royalties mutables vía extensión OZ)
queda obsoleto y reemplazado por este contrato.
