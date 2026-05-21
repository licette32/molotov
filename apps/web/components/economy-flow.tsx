"use client";

import { useEffect, useRef, useState } from "react";

const FLOW = [
  {
    amount: "10,00",
    pct: "royalty 10%",
    label: "al artista",
    note: "Lo paga el contrato. En la primera venta y en cada reventa.",
    accent: true,
  },
  {
    amount: "2,50",
    pct: "fee 2,5%",
    label: "a Molotov",
    note: "Lo único que cobra la plataforma.",
    accent: false,
  },
  {
    amount: "87,50",
    pct: "resto",
    label: "al vendedor",
    note: "Quien posee la obra en este momento.",
    accent: false,
  },
];

export function EconomyFlow() {
  const listRef = useRef<HTMLUListElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="como-cobras"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 md:px-10 md:py-36 lg:px-16"
    >
      <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
        {/* Left: the literal distribution of a single sale. */}
        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            Una venta, repartida
          </p>
          <p className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl leading-tight tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-4xl">
            Una obra se vende a{" "}
            <span className="font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl">
              100&nbsp;XLM
            </span>
            .
          </p>

          <ul ref={listRef} className="mt-12 border-t border-white/12">
            {FLOW.map((row, i) => (
              <li
                key={row.label}
                style={{ transitionDelay: `${i * 120}ms` }}
                className={`reveal flex flex-col gap-1 border-b border-white/12 py-6 md:flex-row md:items-baseline md:gap-8 ${
                  inView ? "in" : ""
                } ${row.accent ? "border-l-2 border-l-[#2D43FF] pl-5 md:pl-6" : ""}`}
              >
                <div className="flex items-baseline gap-3 md:w-64">
                  <span aria-hidden className="text-[#F5F4ED]/40">
                    →
                  </span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-2xl text-[#F5F4ED] md:text-3xl">
                    {row.amount}
                    <span className="ml-1.5 text-sm text-[#F5F4ED]/40">
                      XLM
                    </span>
                  </span>
                </div>
                <div className="pl-7 md:pl-0">
                  <p className="text-base text-[#F5F4ED]">
                    {row.label}
                    <span className="ml-2 font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
                      {row.pct}
                    </span>
                  </p>
                  <p className="mt-0.5 max-w-sm text-sm text-[#F5F4ED]/60">
                    {row.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the comparison as a statement, not a stat. */}
        <div className="flex flex-col justify-center">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl leading-snug [font-variation-settings:'opsz'_40] md:text-3xl">
            En streaming, la plataforma se queda con la mayor parte. Acá la lógica
            está dada vuelta.
          </p>

          <dl className="mt-12 space-y-8">
            <div className="flex items-end justify-between border-b border-white/12 pb-4">
              <dt className="text-base text-[#F5F4ED]/60">
                Se queda una plataforma de streaming
              </dt>
              <dd className="font-[family-name:var(--font-geist-mono)] text-4xl text-[#F5F4ED]/40 md:text-5xl">
                ~70%
              </dd>
            </div>
            <div className="flex items-end justify-between border-b border-white/12 pb-4">
              <dt className="text-base text-[#F5F4ED]">Se queda Molotov</dt>
              <dd className="font-[family-name:var(--font-geist-mono)] text-4xl text-[#5B6CFF] md:text-5xl">
                2,5%
              </dd>
            </div>
          </dl>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-[#F5F4ED]/60">
            La regalía del artista no sale del fee de Molotov: es una porción
            aparte, definida por el propio artista y grabada en el contrato.
          </p>
        </div>
      </div>
    </section>
  );
}
