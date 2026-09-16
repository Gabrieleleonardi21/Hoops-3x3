/** Sezione di pagina: kicker + titolo display + azioni a destra, separata da una riga. */
import { Kicker } from "./Kicker";

export function Section({ title, kicker, actions, children, className = "" }: {
  title: React.ReactNode; kicker?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`mb-8 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-asphalt-700 pb-2 mb-3">
        <div>
          {kicker && <Kicker className="mb-1">{kicker}</Kicker>}
          <h2 className="font-display text-2xl text-chalk">{title}</h2>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
