"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { truncateAddress, IS_TESTNET, STELLAR_NETWORK_NAME } from "@/lib/stellar";

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } =
    useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (!isConnected || !address) {
    return (
      <Button
        onClick={connect}
        disabled={isConnecting}
        className="bg-[#0178DE] text-white hover:bg-[#3493E5]"
      >
        {isConnecting ? "Conectando…" : "Conectar wallet"}
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className="min-h-[44px] border-white/15 bg-transparent font-[family-name:var(--font-geist-mono)] text-[#F5F4ED] hover:bg-white/5 hover:text-[#F5F4ED]"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {IS_TESTNET && (
          <span className="mr-2 rounded border border-white/15 px-1.5 py-0.5 text-[12px] uppercase text-[#F5F4ED]/60">
            TESTNET
          </span>
        )}
        {truncateAddress(address)}
      </Button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-44 rounded-md border border-white/12 bg-[#0A0A0B] p-1 shadow-lg"
        >
          {IS_TESTNET && (
            <div className="mb-1 border-b border-white/12 px-3 py-2 text-xs text-[#F5F4ED]/60">
              Red &middot; {STELLAR_NETWORK_NAME}
            </div>
          )}
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-[#F5F4ED] hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
