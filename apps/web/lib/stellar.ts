import type {
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";

export type { ISupportedWallet, StellarWalletsKit };

/**
 * Network passphrase. Defaults to TESTNET; set NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC
 * to target mainnet. We use the raw passphrase string so the kit package (which
 * registers web components on import) stays out of the server bundle.
 */
export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

/**
 * Creates the multi-provider wallet kit instance supporting Freighter, xBull,
 * Albedo, LOBSTR and Hana. Imported dynamically so it only loads in the browser.
 */
export async function createWalletsKit(): Promise<StellarWalletsKit> {
  const {
    StellarWalletsKit,
    FREIGHTER_ID,
    FreighterModule,
    xBullModule,
    AlbedoModule,
    LobstrModule,
    HanaModule,
  } = await import("@creit.tech/stellar-wallets-kit");

  return new StellarWalletsKit({
    network: STELLAR_NETWORK_PASSPHRASE as WalletNetwork,
    selectedWalletId: FREIGHTER_ID,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new AlbedoModule(),
      new LobstrModule(),
      new HanaModule(),
    ],
  });
}

/** Truncates a Stellar address for display, e.g. GABC…XY12. */
export function truncateAddress(address: string, prefix = 4, suffix = 4): string {
  if (address.length <= prefix + suffix) return address;
  return `${address.slice(0, prefix)}…${address.slice(-suffix)}`;
}
