# Mapa de migración — repo original → Molotov (Stellar)

> Mapeo del repo original (una mini-app en Base / Solidity / Farcaster) hacia
> Molotov (Stellar / Soroban).
> **No se copió código todavía** — esto es sólo el plan.

## Leyenda de acciones

- **REEMPLAZAR** — usa OnchainKit / wagmi / viem / ethers / Base / Solidity / Farcaster. Hay que rehacerlo con el equivalente Stellar.
- **MANTENER** — usa Lighthouse / IPFS (o utilidades neutrales). Se conserva casi tal cual.
- **PORTAR** — usa Next.js / Tailwind / shadcn / TS. Mismo concepto, código nuevo adaptado a Molotov.
- **REUTILIZAR** — componente UI puro o util genérico. Se trae con adaptaciones de diseño según `apps/web/.agents/skills/design-system/molotov-overrides.md`.
- **DESCARTAR** — específico de la mini-app de Farcaster o redundante con el monorepo; no aplica.

## Notas de contexto (decisiones que afectan el mapeo)

1. El original **deploya un contrato ERC-721 nuevo por cada NFT** (`deployContractAsync` con bytecode en `create-nft/page.tsx`). En Molotov hay **un** `MolotovNFT` desplegado y se **mintea** dentro de él (Paso 6). Es un cambio conceptual, no un port directo.
2. El original mezcla **tres** mecanismos de storage: Lighthouse (IPFS), Synapse (Filecoin) y `nft.storage`. La stack de Molotov es **IPFS vía Lighthouse, únicamente** → se mantiene Lighthouse y se descartan Filecoin/Synapse y nft.storage.
3. Toda la capa Farcaster mini-app (`MiniKit`, frames, `.well-known/farcaster.json`, webhook, Redis) **no aplica** a Molotov (web/mobile estándar).

---

## App router (`app/`)

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `app/layout.tsx` | Root layout. Importa estilos de OnchainKit, define metadata `fc:frame` (Farcaster), envuelve con `<Providers>`. | **PORTAR.** Layout nuevo: sacar import de OnchainKit y la metadata de Farcaster; envolver con `WalletProvider` (Paso 3). `lang="es"` por default, fuentes Fraunces/Geist, `bg-background` oscuro. |
| `app/page.tsx` | Home: compone `NavBar + Hero + FilterSection + NFTGrid`. | **PORTAR.** Misma composición; se reconstruye como la landing del Paso 5 (marquee, hero, stats, grid, manifiesto, footer). |
| `app/create-nft/page.tsx` | Subida de archivo + mint. Sube a Lighthouse, **deploya** un ERC-721 con `deployContractAsync` (wagmi). | **PORTAR + REEMPLAZAR.** UX de subida se porta; el upload a Lighthouse se **MANTIENE**; el deploy/mint se **REEMPLAZA** por `mint` en `MolotovNFT` vía bindings TS (hook `use-mint`, Paso 9). Campo "SYMBOL" → reemplazar por royalty config. |
| `app/globals.css` | Variables CSS de tema (shadcn) + Tailwind base. | **PORTAR.** Reescribir tokens con la paleta Molotov (negro/off-white/#2D43FF) según overrides. |
| `app/theme.css` | Tema de OnchainKit (`mini-app-theme`). | **REEMPLAZAR/DESCARTAR.** Específico de OnchainKit; no aplica. |
| `app/contracts/NFT.json` | ABI + bytecode de un ERC-721 Solidity (`mint`, `tokenURI`, `safeTransferFrom`, etc.). | **REEMPLAZAR.** Por los bindings TS de `MolotovNFT` (Soroban) generados en Paso 6, en `packages/stellar-client/src/nft.ts`. |
| `app/.well-known/farcaster.json/route.ts` | Manifest de Farcaster mini-app (account association, frame). | **DESCARTAR.** No aplica a Molotov. |

## Providers y librerías (`context/`, `lib/`)

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `context/providers.tsx` | `MiniKitProvider` (OnchainKit) en chain `base`, maneja `frameReady`. | **REEMPLAZAR.** Por `WalletProvider` con Stellar Wallets Kit (Freighter, xBull, Albedo, LOBSTR, Hana), network testnet por env (Paso 3). |
| `lib/filecoin.ts` | Hook `useFileUpload` que sube a Filecoin vía `@filoz/synapse-sdk`. | **REEMPLAZAR/DESCARTAR.** Molotov usa sólo Lighthouse/IPFS; consolidar la subida en un `lib/lighthouse.ts` (o hook `use-mint`). |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge). | **REUTILIZAR.** Idéntico, sin cambios. |

## Componentes (`components/`)

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `components/NavBar.tsx` | Header con logo + link Explore + `Wallet`/`ConnectWallet`/`WalletDropdown`/`Identity` de OnchainKit + menú mobile. | **REEMPLAZAR + PORTAR.** Shell del nav se porta; toda la pieza de wallet (OnchainKit) se **REEMPLAZA** por `wallet-button.tsx` (dirección truncada `GABC…XY12`, dropdown desconectar). Links/copy a es-AR. |
| `components/Hero.tsx` | Hero "Collect, Display, Live. MOLOTOV" + CTA Create NFT. | **PORTAR.** Rediseñar según overrides (Fraunces gigante, copy es-AR, sin gradientes purple-pink). Marca "Molotov" ya existe. |
| `components/NFTGrid.tsx` | Grid de NFTs con **data mockeada** (precios en ETH, likes/views), card con media + precio + "Place Bid". | **PORTAR + REEMPLAZAR.** Layout de card se porta (media grande arriba, info abajo); la data mock se **REEMPLAZA** por lecturas on-chain (hook `use-nft`); ETH → precio dual XLM+USD en mono; agregar badge de royalty. |
| `components/FilterSection.tsx` | Encabezado "Featured Collection" (filtros comentados). | **REUTILIZAR/PORTAR.** Estructura simple; reactivar filtros si hacen falta, copy es-AR. |
| `components/NFTMintSuccess.tsx` | Pantalla de éxito post-mint: hash, tokenURI, "Base Network", links a BaseScan, emojis. | **PORTAR.** Rehacer: "Base Network" → Stellar testnet/mainnet; BaseScan → stellar.expert; quitar emojis (regla de copy); hashes/URIs en mono. |
| `components/ui/badge.tsx` | Primitiva shadcn (CVA). | **REUTILIZAR** con tokens Molotov. |
| `components/ui/button.tsx` | Primitiva shadcn (CVA + Slot). | **REUTILIZAR** con tokens Molotov. |
| `components/ui/card.tsx` | Primitiva shadcn. | **REUTILIZAR** con tokens Molotov. |
| `components/ui/input.tsx` | Primitiva shadcn. | **REUTILIZAR** con tokens Molotov. |
| `components/ui/label.tsx` | Primitiva shadcn (Radix). | **REUTILIZAR** con tokens Molotov. |
| `components/ui/textarea.tsx` | Primitiva shadcn. | **REUTILIZAR** con tokens Molotov. |

## Configuración

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `package.json` | Deps de la app (OnchainKit, wagmi, viem, ethers, Farcaster, Synapse, etc.) + scripts Next. | **REEMPLAZAR + PORTAR.** Sacar deps Base/Solidity/Farcaster/Filecoin; agregar Stellar Wallets Kit + Stellar SDK; scripts se integran al monorepo (turbo). |
| `tailwind.config.ts` | Tailwind v3, tokens shadcn vía CSS vars, `darkMode: class`. | **PORTAR.** Adaptar a la versión de Tailwind de `apps/web` y a los tokens Molotov. |
| `components.json` | Config shadcn (style new-york, baseColor neutral, aliases). | **REUTILIZAR/PORTAR.** Mantener aliases; revisar baseColor para tema oscuro. |
| `next.config.mjs` | Externals webpack para silenciar WalletConnect/pino. | **PORTAR.** Quitar los externals de WalletConnect (no aplican sin wagmi). |
| `postcss.config.mjs` | PostCSS para Tailwind. | **PORTAR.** Según setup de `apps/web`. |
| `tsconfig.json` | Config TS + paths `@/*`. | **PORTAR.** Mantener alias `@/*`. |
| `.eslintrc.json` | ESLint legacy (eslint-config-next). | **REEMPLAZAR.** El monorepo ya usa ESLint flat config (Paso 0). |
| `.prettierrc` | Config Prettier. | **REUTILIZAR.** Ya existe `.prettierrc.json` en el monorepo. |
| `env.example` | Vars de OnchainKit + Farcaster + CDP. | **REEMPLAZAR.** Nuevas vars: network Stellar, contract IDs, `LIGHTHOUSE_STORAGE_KEY`, Supabase. |
| `README.md` | Quick start de la mini-app. | **PORTAR.** Ya hay README de monorepo; tomar sólo notas útiles de la app. |
| `bun.lock` / `package-lock.json` | Lockfiles (bun / npm). | **DESCARTAR.** El monorepo usa pnpm. |

## Dependencias clave (decisión por librería)

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `@coinbase/onchainkit` | Wallet, Identity, MiniKit (Base). | **REEMPLAZAR** por `@creit.tech/stellar-wallets-kit`. |
| `wagmi` | Hooks EVM (useAccount, useDeployContract). | **REEMPLAZAR** por hooks propios sobre bindings Soroban + Stellar SDK. |
| `viem` | Cliente EVM low-level. | **REEMPLAZAR** por `@stellar/stellar-sdk`. |
| `ethers` | Utils EVM (usado por Synapse). | **REEMPLAZAR/DESCARTAR.** No hay EVM en Molotov. |
| `@farcaster/frame-sdk` | SDK de frames Farcaster. | **DESCARTAR.** |
| `@filoz/synapse-sdk` | Storage en Filecoin. | **REEMPLAZAR/DESCARTAR.** Molotov usa sólo Lighthouse/IPFS. |
| `nft.storage` | Storage NFT (IPFS/Filecoin). | **DESCARTAR.** Redundante con Lighthouse. |
| `@lighthouse-web3/sdk` | Subida a IPFS vía Lighthouse. | **MANTENER.** Es el storage oficial de Molotov. |
| `@tanstack/react-query` | Data fetching/caching. | **MANTENER/REUTILIZAR.** Patrón de hooks del Paso 9 (data/isLoading/error/mutate). |
| `@upstash/redis` | Redis (webhook/notifs de Farcaster). | **DESCARTAR** salvo que aparezca un uso off-chain real (entonces evaluar Supabase). |
| `@radix-ui/*` | Primitivas headless (base de shadcn). | **REUTILIZAR.** Necesarias para los componentes shadcn. |
| `lucide-react` | Íconos. | **MANTENER.** |
| `clsx` / `tailwind-merge` / `class-variance-authority` | Utils de estilos. | **MANTENER.** Usados por `cn()` y shadcn. |

## Public / assets (`public/`)

| Componente / archivo original | Qué hace | Equivalente en Molotov Stellar |
|---|---|---|
| `public/molotov-logo.svg`, `public/molotov-full-logo.svg` | Logos de marca Molotov. | **REUTILIZAR.** Marca ya alineada; validar contra identidad final. |
| `public/full-logo.png`, `logo.png`, `Icon.svg`, `icon.png` | Logos/íconos varios. | **REUTILIZAR/REVISAR.** Quedarse con los SVG de marca; descartar duplicados. |
| `public/assets/*` (img1–4, marble, gif-fuego.mp4) | Arte placeholder del grid mock. | **DESCARTAR.** Reemplazar por obras reales / placeholders propios. |
| `public/mini-logo.svg`, `splash.png`, `og.png`, `hero.png`, `screenshot.png` | Assets de la mini-app / Farcaster. | **REEMPLAZAR/DESCARTAR.** Regenerar OG/hero propios; el resto no aplica. |
</content>
