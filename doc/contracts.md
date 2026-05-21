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

## molotov-nft (scaffold — Paso 4)

Scaffold del NFT de la colección. Extensiones OpenZeppelin Stellar activas:
`Enumerable` (ContractType) + `Burnable` + `Royalties` + `Ownable`.

> Nota: es el scaffold para validar el pipeline build → deploy. La lógica de
> producción (regalías inmutables, gating por ArtistRegistry, split multi-wallet)
> se implementa en un paso posterior.

### Deploy actual (testnet)

| Campo | Valor |
|---|---|
| Network | TESTNET (`Test SDF Network ; September 2015`) |
| Contract ID | `CB3OUQCNNYIGN6IONO5YJVK3QOROGI22T6MB24NPWJNZDPTCLUCRJLA2` |
| WASM hash | `7c7e109e92ca1336d6864916c8be4d37760da5b5faedcef5f6a9a549171d881f` |
| Owner | `GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM` |
| Metadata | name `Molotov` · symbol `MOLO` · uri `ipfs://placeholder-collection-metadata` |
| Royalty default | 500 bps (5%) |

Explorer: <https://stellar.expert/explorer/testnet/contract/CB3OUQCNNYIGN6IONO5YJVK3QOROGI22T6MB24NPWJNZDPTCLUCRJLA2>

### Reproducir el deploy

Desde `contracts/`:

```bash
# 1. Tests
cargo test

# 2. Compilar a WASM
stellar contract build
# artefacto: target/wasm32v1-none/release/molotov_nft.wasm

# 3. Deploy a testnet (constructor args tras el `--`)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/molotov_nft.wasm \
  --source molotov-dev \
  --network testnet \
  -- \
  --owner GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM \
  --uri "ipfs://placeholder-collection-metadata" \
  --name "Molotov" \
  --symbol "MOLO" \
  --default_royalty_bps 500
```

### Smoke test (lecturas, gratis en Stellar)

```bash
stellar contract invoke --id <CONTRACT_ID> --source molotov-dev --network testnet -- name
stellar contract invoke --id <CONTRACT_ID> --source molotov-dev --network testnet -- symbol
stellar contract invoke --id <CONTRACT_ID> --source molotov-dev --network testnet -- get_owner
stellar contract invoke --id <CONTRACT_ID> --source molotov-dev --network testnet -- total_supply
```

### Interfaz expuesta

`mint`, `mint_with_royalty`, `burn`, `burn_from`, `transfer`, `transfer_from`,
`approve`, `get_approved`, `is_approved_for_all`, `owner_of`, `balance`,
`total_supply`, `get_token_id`, `get_owner_token_id`, `name`, `symbol`,
`token_uri`, `royalty_info`, `set_default_royalty`, `set_token_royalty`,
`remove_token_royalty`, `get_owner`, `transfer_ownership`, `renounce_ownership`.
