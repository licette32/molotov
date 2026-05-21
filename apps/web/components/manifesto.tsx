export function Manifesto() {
  return (
    <section
      id="manifiesto"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 md:px-10 md:py-36 lg:px-16"
    >
      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-20">
        <div className="md:pt-2">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl [font-variation-settings:'opsz'_40]">
            Manifiesto
          </p>
          <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/40">
            Buenos Aires, 2026
          </p>
        </div>

        <div className="max-w-2xl space-y-7 font-[family-name:var(--font-fraunces)] text-xl leading-[1.5] tracking-[-0.005em] text-[#F5F4ED]/90 [font-variation-settings:'opsz'_40] md:text-2xl">
          <p>
            No hicimos Molotov para especular. Lo hicimos para que un artista
            pueda <em className="italic text-[#5B6CFF]">vivir de su obra</em>.
          </p>
          <p>
            Durante siglos el artista vendió una vez y vio cómo su trabajo se
            revalorizaba en manos ajenas. La regalía existía en el papel y casi
            nunca en la práctica.
          </p>
          <p>
            Acá la regalía no es una cláusula que alguien promete cumplir: es
            código. Está grabada en el contrato cuando minteás y nadie —ni
            nosotros— puede cambiarla. En cada reventa, el artista cobra antes de
            que la operación se cierre.
          </p>
          <p>
            No vendemos especulación. Vendemos arte, y defendemos a quien lo
            hace.
          </p>
          <p className="font-[family-name:var(--font-geist-mono)] text-[14px] text-[#F5F4ED]/40 [font-variation-settings:initial]">
            — Molotov, mayo 2026
          </p>
        </div>
      </div>
    </section>
  );
}
