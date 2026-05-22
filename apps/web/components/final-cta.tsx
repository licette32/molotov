import Link from "next/link";

export function FinalCta() {
  return (
    <section
      id="crear"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-28 md:px-10 md:py-44 lg:px-16"
    >
      <h2 className="max-w-[16ch] font-[family-name:var(--font-fraunces)] text-[clamp(2.5rem,9vw,8rem)] font-light leading-[0.95] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
        Subí tu primera obra esta semana.
      </h2>

      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href="/crear"
          className="inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
        >
          Mintear primera obra
        </Link>
        <a
          href="#actividad"
          className="inline-flex h-12 items-center px-2 font-[family-name:var(--font-geist-mono)] text-[14px] text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
        >
          ¿Coleccionás? Ver obras en venta
        </a>
      </div>
    </section>
  );
}
