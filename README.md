# Molotov

Marketplace Web3 de arte digital para artistas visuales contemporáneos. La premisa es
**"Spotify invertido"**: el ingreso fluye hacia el artista, no al revés.

El diferencial técnico son las **regalías grabadas on-chain** (1–15%, configurables al mintear
e inmutables después). En cada reventa el contrato distribuye la regalía al artista de forma
automática, y la venta no se completa si la regalía no se distribuye.

## Stack

- **Web:** Next.js 16 + React 19 + Tailwind + shadcn/ui
- **Mobile:** React Native + Expo + NativeWind
- **Contratos:** Soroban (Rust) + OpenZeppelin Stellar Contracts
- **Wallet:** Stellar Wallets Kit (Freighter, xBull, Albedo, LOBSTR)
- **DB:** Supabase (auth + datos off-chain)
- **Storage:** IPFS vía Lighthouse
- **Monorepo:** pnpm + turborepo

## Quick start

Requisitos: Node 20 (ver `.nvmrc`), pnpm 10, Rust con target `wasm32v1-none` y la CLI de Stellar
(para los contratos).

```bash
git clone <repo-url> molotov
cd molotov
pnpm install
pnpm dev
```

## Tareas disponibles

Todas corren a través de turborepo desde la raíz:

```bash
pnpm dev      # levanta las apps en modo desarrollo
pnpm build    # buildea todo el workspace
pnpm lint     # corre ESLint en apps y packages
pnpm test     # corre los tests del workspace
pnpm format   # formatea con Prettier
```

## Estructura del monorepo

```
molotov/
├── apps/
│   ├── web/             # Next.js 16 + Tailwind + shadcn
│   └── mobile/          # Expo + expo-router + NativeWind
├── contracts/
│   ├── nft/             # MolotovNFT (Soroban)
│   ├── marketplace/     # Marketplace con royalty enforcement
│   └── artist-registry/ # Registro de artistas verificados
├── packages/
│   ├── stellar-client/  # Bindings TS de los contratos + cliente Stellar
│   ├── types/           # Tipos compartidos
│   └── ui/              # Componentes UI compartidos
├── supabase/            # Schema y migraciones off-chain
└── doc/
    └── adr/             # Architecture Decision Records
```

## Idiomas e identidad

Copy y mensajes al usuario en español (Argentina por default), con EN y PT planificados.
Identidad editorial/galería, anti-cripto-bro. Paleta azul/negro/blanco, acento `#2D43FF`.
