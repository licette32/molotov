import { WalletButton } from "@/components/wallet-button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/12 px-6 py-4">
        <span className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight">
          Molotov
        </span>
        <WalletButton />
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-6xl font-semibold tracking-tight sm:text-8xl">
          Molotov
        </h1>
      </main>
    </div>
  );
}
