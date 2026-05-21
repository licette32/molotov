import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

const LINKS = [
  { href: "#como-cobras", label: "Cómo cobrás" },
  { href: "#actividad", label: "Actividad" },
  { href: "#manifiesto", label: "Manifiesto" },
  { href: "#contrato", label: "Contrato" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/12 bg-black/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 lg:px-16">
        <Link
          href="/"
          className="font-[family-name:var(--font-fraunces)] text-2xl font-medium tracking-tight [font-variation-settings:'opsz'_72] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D43FF]"
          aria-label="Molotov, inicio"
        >
          Molotov
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-wide text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D43FF]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <WalletButton />
      </nav>
    </header>
  );
}
