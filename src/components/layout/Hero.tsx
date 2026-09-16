/** Banda hero con la foto del campetto (public/hero-court.jpg) e overlay scuro a sinistra
 *  per la leggibilità del testo. Usata solo nella HomePage. */
export function Hero({ kicker, title, subtitle, badge, actions, aside }: {
  kicker?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
  badge?: React.ReactNode; actions?: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded border border-asphalt-700 bg-asphalt-900">
      <img src="/hero-court.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" width={1376} height={768} />
      {/* overlay: navy brand a sinistra che sfuma sull'immagine */}
      <div className="absolute inset-0 bg-gradient-to-r from-asphalt-950 via-asphalt-950/85 to-navy/30" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          {(kicker || badge) && (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {badge}
              {kicker && <span className="kicker text-chalk">{kicker}</span>}
            </div>
          )}
          <h1 className="font-display text-[clamp(40px,7vw,72px)] text-chalk">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-chalk-muted">{subtitle}</p>}
          {actions && <div className="mt-5 flex flex-wrap gap-2.5">{actions}</div>}
        </div>
        {aside && <div className="w-full md:w-[400px] shrink-0">{aside}</div>}
      </div>
    </section>
  );
}
