# Molotov

A Web3 marketplace for contemporary visual art, built on Stellar (Soroban).
The differentiator: **royalties are written into the contract at mint time** —
between 1% and 15%, configurable by the artist, immutable afterwards. Every
resale pays the artist before the transfer closes; the sale does not complete
if the royalty does not.

The contract enforces the royalty, not the platform.

Editorial / gallery aesthetic, intentionally anti-crypto-bro.

## Status

Beta on Stellar testnet. Live NFT contract:
[`CCRGD3F…FMT4`](https://stellar.expert/explorer/testnet/contract/CCRGD3FAIZY4VRP55QFMFFSSAEKYMZE7LB5EF6OXPVYVYNVXEC7UFMT4).

## Stack

- **Web:** Next.js 16 + React 19 + Tailwind + shadcn/ui
- **Mobile:** React Native + Expo + NativeWind
- **Contracts:** Soroban (Rust) + OpenZeppelin Stellar Contracts
- **Wallet:** Stellar Wallets Kit (Freighter, xBull, Albedo, LOBSTR)
- **Database:** Supabase (auth + off-chain data)
- **Storage:** IPFS via Pinata
- **Monorepo:** pnpm + Turborepo

## Quick start

Requirements: Node 20 (see `.nvmrc`), pnpm 10, Rust with the `wasm32v1-none`
target and the Stellar CLI (for the contracts).

```bash
git clone <repo-url> molotov
cd molotov
pnpm install
pnpm dev
```

For the mint flow, copy `apps/web/.env.example` to `apps/web/.env.local` and
add a Pinata JWT — setup steps in `apps/web/docs/pinata-setup.md`.

## Available tasks

All run through Turborepo from the repo root:

```bash
pnpm dev      # start apps in development mode
pnpm build    # build the entire workspace
pnpm lint     # run ESLint across apps and packages
pnpm test     # run workspace tests
pnpm format   # format with Prettier
```

## Monorepo layout

```
molotov/
├── apps/
│   ├── web/             # Next.js 16 + Tailwind + shadcn
│   └── mobile/          # Expo + expo-router + NativeWind
├── contracts/
│   ├── nft/             # MolotovNFT (Soroban)
│   ├── marketplace/     # Marketplace with royalty enforcement
│   └── artist-registry/ # Verified-artist registry
├── packages/
│   ├── stellar-client/  # TS contract bindings + Stellar client helpers
│   ├── types/           # Shared types
│   └── ui/              # Shared UI components
├── supabase/            # Off-chain schema and migrations
└── doc/
    ├── adr/             # Architecture Decision Records
    ├── branding/        # Brand assets and value proposition
    └── contracts.md     # On-chain contract registry
```

## Identity & languages

Dark base, off-white text, flame-blue accent (`#0178DE`, sampled from the
official logo). Display type: Fraunces. Body: Geist / Geist Mono.

User-facing copy is Spanish (Argentina) by default. English and Portuguese
support is on the roadmap.
