import { NFT_CONTRACT_ID, contractExplorerUrl, truncateAddress } from "@/lib/stellar";

// Product properties live here as an archive-style list, not a marquee.
const PROPS = [
  "Regalías 1–15% on-chain",
  "Inmutables tras el minteo",
  "Fee de plataforma 2,5%",
  "Sin contenido generado por IA",
  "Stellar · fees ~US$0,00001",
  "Hecho en LATAM",
];

const PRODUCT = [
  { href: "#como-cobras", label: "Cómo cobrás" },
  { href: "#actividad", label: "Actividad" },
  { href: "#manifiesto", label: "Manifiesto" },
  { href: "#crear", label: "Mintear obra" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/12">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-3 md:px-10 lg:px-16">
        <div>
          <p className="font-[family-name:var(--font-fraunces)] text-xl [font-variation-settings:'opsz'_40]">
            Molotov
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#F5F4ED]/60">
            Marketplace de arte digital con regalías grabadas en el contrato. El
            ingreso vuelve hacia el artista.
          </p>
        </div>

        <nav aria-label="Producto">
          <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            Producto
          </p>
          <ul className="mt-4 space-y-2">
            {PRODUCT.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D43FF]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            Propiedades
          </p>
          <ul className="mt-4 space-y-2">
            {PROPS.map((prop) => (
              <li
                key={prop}
                className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/60"
              >
                {prop}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/12 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 lg:px-16">
        <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
          © 2026 Molotov · Beta en Stellar testnet
        </p>
        <a
          href={contractExplorerUrl(NFT_CONTRACT_ID)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D43FF]"
        >
          Contrato {truncateAddress(NFT_CONTRACT_ID, 6, 6)} ↗
        </a>
      </div>
    </footer>
  );
}
