import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/wallet-provider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Molotov",
  description:
    "Marketplace de arte digital con regalías on-chain. El ingreso vuelve hacia el artista.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-black text-[#F5F4ED] font-[family-name:var(--font-geist-sans)]">
        {/* Grain overlay: sits above the black background, below content (z-10). */}
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.04]" />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
