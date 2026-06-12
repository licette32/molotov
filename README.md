# Molotov

**A digital-art marketplace where the royalty is enforced by the contract.** On every resale, the artist is paid automatically — or the sale doesn't happen. Income flows *to* the creator, not away from them. We call it *inverted Spotify*.

> Smart contracts live and verified on Stellar testnet · Backend proven end-to-end · Web app in progress

---

## The problem

When a digital artwork resells for more, **the artist who made it usually sees nothing.** The upside goes to speculators and platforms. The market rewards trading, not creating.

Web3 was supposed to fix this with royalties — a cut for the artist on every resale. In practice, that promise collapsed. To compete on lower fees, the major NFT marketplaces made royalties **optional**, dependent on the goodwill of the buyer or the platform. Creators were cut out again, this time with extra jargon on top.

The real problem isn't technical — it's about **who captures the value**. And that gets decided in exactly one place: the contract that moves the money.

## The solution

Molotov makes the royalty **immutable and mandatory at the contract level**:

- The artist sets their royalty when minting (**1–15%**). Once minted, it **can never be changed**.
- On every resale, the marketplace contract reads that royalty and pays the artist **before the sale can close**. No royalty distributed, no sale.
- The contract acts as **escrow**: it never over-custodies funds, leaves no residual, and the parts always sum **to the stroop** (the smallest unit of XLM, 1/10,000,000).

You don't have to trust the platform. The guarantee is in the code — public and verifiable.

## How it works — a real example

**A 100 XLM resale.** An artist set a **10% royalty** when they minted a piece. A collector resells it for 100 XLM:

| Recipient | Amount | |
|---|---|---|
| **Artist** (royalty) | 10 XLM | paid automatically, enforced by the contract |
| **Platform fee** | 2.5 XLM | |
| **Seller** | 87.5 XLM | |

Every unit is accounted for, down to the stroop. If the royalty can't be distributed, the contract **reverts the entire sale** — the artist getting paid is not a step that can be skipped.

An optional **referral** share is carved *out of* the platform fee (never added to the price): whoever brings a buyer earns part of the fee, not a cent from anyone else's pocket.

## Architecture

Three Soroban contracts, each with one responsibility:

| Contract | Responsibility |
|---|---|
| **MolotovNFT** | The artwork token. Stores the artist's immutable royalty (SEP-50). |
| **ArtistRegistry** | Registry of verified artists. Only a registered artist can mint. |
| **Marketplace** | The economic engine. Escrow, listings, open editions, and royalty enforcement on every sale. |

**Off-chain layer (indexer).** The chain is the source of truth, but querying it directly for "all works by this artist" is slow. An indexer reads the events the contracts emit, decodes them, and projects them into a queryable database (Supabase). That projection is **reconstructable**: wipe it, replay the events, and you get exactly the same state. The web app reads from there.

```
Contracts (Stellar) ── emit events
        ↓
Soroban RPC (getEvents)
        ↓
Indexer (poller): fetch → decode → write → advance cursor ↻
        ↓
Supabase (queryable projection)
        ↓
Web app
```

## The business

**Market.** Molotov is for contemporary digital artists who want their work to earn over time, not only at first sale. The creator economy is large and growing — but the tooling built for it has failed creators on one specific point: resale royalties.

**Why now.** Web3 promised artists a cut of every resale, then the major marketplaces made royalties optional to win a fee war, and creators lost most of their expected resale income overnight. Artists are actively looking for a home where the royalty is **guaranteed** — not a policy, but a rule. That's the wedge.

**How Molotov makes money.** A flat **2.5% platform fee** on every sale, primary and secondary. Revenue scales with marketplace volume. That fee is **half** of what objkt — the leading art marketplace on Tezos — charges (5%), so the pitch to artists is direct: a lower platform cut *and* a royalty that can't be bypassed. The referral share is carved out of that fee, giving the marketplace a built-in growth lever.

**Why Stellar.** Low fees and fast settlement make small-value art sales and micro-royalties economically viable — on high-gas chains, network fees can swallow a small royalty whole.

**The moat.** The royalty guarantee lives in the contract: public, immutable, verifiable. Paired with an editorial, gallery-first brand (deliberately *not* crypto-bro), Molotov targets serious artists that hype-driven platforms underserve.

## What's live

This is a working pitch — the section below is not what we *plan* to build, it's what is **already deployed and verified**.

**Contracts — live on Stellar testnet:**

- ArtistRegistry — [`CC37LTUP…GU533`](https://stellar.expert/explorer/testnet/contract/CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533)
- Marketplace — [`CB6T6DOY…2K7DU`](https://stellar.expert/explorer/testnet/contract/CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU)
- MolotovNFT — *(see `doc/contracts.md`)*

**Engineering rigor — applied, not assumed:**

- **Mutation testing** (cargo-mutants): 0 surviving mutants across the money and governance functions (`distribute`, `buy`, `list`, `cancel`, `upgrade`). Every latent bug it surfaced was fixed.
- **Static analysis** (Scout): 0 findings across all three contracts.
- **Conservation proven live**: a 100 XLM secondary sale with a 10% royalty and 2.5% fee settles exactly — artist, treasury and seller balance to the stroop, zero residual.
- **Indexer idempotency proven**: replaying the same events yields an identical projection, with no duplicated sales. The continuous loop picks up fresh mints within one ledger.

## Roadmap

- **Done** — On-chain contracts (NFT + Registry + Marketplace) deployed, tested and verified. Full indexer with idempotent ingestion.
- **In progress** — The web app reading from Supabase: gallery, wallet-based purchase, artist profiles, manifesto, activity feed.
- **Next** — Mainnet: admin keys to multisig, final fee and royalty-cap decisions, audit. Mobile apps and multi-language support (EN, PT).

## Getting started

Requirements: Node 20 (see `.nvmrc`), pnpm 10, Rust with the `wasm32v1-none` target, and the Stellar CLI (for the contracts).

```bash
git clone https://github.com/BuenDia-Builders/molotov.git
cd molotov
pnpm install
pnpm dev
```

Workspace tasks (via turborepo, from the root):

```bash
pnpm dev      # run the apps in development
pnpm build    # build the workspace
pnpm lint     # ESLint across apps and packages
pnpm test     # run the workspace tests
pnpm format   # Prettier
```

## Tech stack

- **Web:** Next.js 16 + React 19 + Tailwind + shadcn/ui
- **Contracts:** Soroban (Rust) + OpenZeppelin Stellar Contracts
- **Wallet:** Stellar Wallets Kit (Freighter, xBull, Albedo, LOBSTR)
- **Indexer + off-chain data:** Supabase (a reconstructable projection of on-chain events)
- **Storage:** IPFS
- **Monorepo:** pnpm + turborepo


## Language & identity

In-app copy is **Spanish-first** (Argentina by default), with EN and PT planned. The brand is editorial and gallery-like, deliberately anti-crypto-bro: a blue/black/white palette with a `#2D43FF` accent. This README is in English to reach the broader Stellar and builder ecosystem.

---

*Molotov — digital art where creating earns you a permanent stake in what you made.*
