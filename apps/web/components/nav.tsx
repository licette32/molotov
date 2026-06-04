"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { type Locale, useI18n } from "@/lib/i18n";

const LINKS = [
  { href: "#como-cobras", labelKey: "nav.howYouEarn" },
  { href: "#actividad", labelKey: "nav.activity" },
  { href: "#manifiesto", labelKey: "nav.manifesto" },
  { href: "#contrato", labelKey: "nav.contract" },
] as const;

const LOCALES: Locale[] = ["es", "en"];

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.16em] text-[#F5F4ED]/50">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-current={locale === option ? "true" : undefined}
          className={`underline-offset-4 transition-colors hover:text-[#F5F4ED] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE] ${
            locale === option ? "text-[#F5F4ED] decoration-[#0178DE] underline" : ""
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Nav() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Body scroll lock + Escape key + auto-focus first focusable on open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>("a, button");
      focusable?.[0]?.focus();
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus trap inside the drawer.
  const handleTabTrap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>("a, button");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/12 bg-black/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 lg:px-16">
          <Link
            href="/"
            className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0178DE]"
            aria-label={t("nav.homeLabel")}
          >
            <Image
              src="/brand/logo-wordmark-dark.png"
              alt="Molotov"
              width={820}
              height={612}
              priority
              className="h-10 w-auto md:h-11"
            />
          </Link>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-wide text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
                >
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <WalletButton />
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-white/20 text-[#F5F4ED] md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
              aria-label={t("nav.openMenu")}
              aria-expanded={isOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer — sits outside the sticky header to cover the viewport. */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div
            ref={drawerRef}
            onKeyDown={handleTabTrap}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menuLabel")}
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/12 bg-[#050505] p-6 shadow-2xl"
          >
            <div className="mb-8 flex items-center justify-between border-b border-white/12 pb-4">
              <span className="font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-wider text-[#F5F4ED]/40">
                {t("nav.menuLabel")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  hamburgerRef.current?.focus();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/12 text-[#F5F4ED] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
                aria-label={t("nav.closeMenu")}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col space-y-2">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="rounded-sm border-b border-white/5 py-4 font-[family-name:var(--font-fraunces)] text-2xl text-[#F5F4ED] transition-colors hover:text-[#F5F4ED]/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
                >
                  {t(link.labelKey)}
                </a>
              ))}
            </div>

            <div className="mt-8 border-t border-white/12 pt-6">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
