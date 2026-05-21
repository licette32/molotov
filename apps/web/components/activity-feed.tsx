// Sample data. Real activity will be indexed from on-chain events once the
// marketplace contract is live. Labeled as muestra so it never reads as a lie.
const ACTIVITY = [
  {
    when: "hace 3 min",
    seller: "Carolina M.",
    work: "Río Paraná",
    buyer: "Mateo G.",
    royaltyPct: "10%",
    royaltyXlm: "12,00",
    artist: "Carolina",
  },
  {
    when: "hace 41 min",
    seller: "Estudio Sur",
    work: "Cielo de Mendoza, III",
    buyer: "Lucía V.",
    royaltyPct: "7,5%",
    royaltyXlm: "6,75",
    artist: "Tomás P.",
  },
  {
    when: "hace 2 h",
    seller: "Joaquín R.",
    work: "Colectivo 60",
    buyer: "Anónimo",
    royaltyPct: "12%",
    royaltyXlm: "21,60",
    artist: "Joaquín R.",
  },
  {
    when: "hace 5 h",
    seller: "Galería Once",
    work: "Siesta en Salta",
    buyer: "Federico A.",
    royaltyPct: "10%",
    royaltyXlm: "9,00",
    artist: "Renata B.",
  },
  {
    when: "ayer",
    seller: "Renata B.",
    work: "Sin título (serie agua)",
    buyer: "Camila D.",
    royaltyPct: "15%",
    royaltyXlm: "30,00",
    artist: "Renata B.",
  },
  {
    when: "ayer",
    seller: "Mateo G.",
    work: "Andén 4",
    buyer: "Estudio Sur",
    royaltyPct: "5%",
    royaltyXlm: "2,50",
    artist: "Inés L.",
  },
];

export function ActivityFeed() {
  return (
    <section
      id="actividad"
      className="scroll-mt-24 px-4 py-24 md:px-6 md:py-36"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-4xl">
          El artista cobra. Cada vez.
        </h2>
        <p className="shrink-0 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.16em] text-[#F5F4ED]/40">
          Datos de muestra
        </p>
      </div>

      <ul className="mt-12 border-t border-white/12">
        {ACTIVITY.map((entry, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-2 border-b border-white/12 py-5 md:grid-cols-[7rem_1fr_auto] md:items-baseline md:gap-8"
          >
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/40">
              {entry.when}
            </span>
            <p className="text-base text-[#F5F4ED]/80">
              <span className="text-[#F5F4ED]">{entry.seller}</span> vendió{" "}
              <span className="font-[family-name:var(--font-fraunces)] italic [font-variation-settings:'opsz'_24]">
                «{entry.work}»
              </span>{" "}
              a {entry.buyer}.
            </p>
            <p className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/60 md:text-right">
              royalty {entry.royaltyPct} ·{" "}
              <span className="text-[#5B6CFF]">{entry.royaltyXlm} XLM</span> →{" "}
              {entry.artist}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
