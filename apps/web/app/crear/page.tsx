import type { Metadata } from "next";
import { CrearClient } from "./crear-client";

// Per-route metadata is static (SSR snapshot). The I18nProvider may update
// document.title on locale switch from the layout dictionary; for now we ship
// the ES copy as the canonical title — same trade-off as the root layout.
export const metadata: Metadata = {
  title: "Mintear obra — Molotov",
  description:
    "Subí tu obra a Stellar con regalías inmutables grabadas en el contrato.",
};

export default function CrearPage() {
  return <CrearClient />;
}
