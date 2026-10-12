/** Scoreboard riutilizzabile: due squadre, punteggio grande in Barlow Condensed, vincitore in chalk
 *  e perdente attenuato. `center` è lo slot tra i due punteggi (input, clock, "vs"),
 *  `footer` quello sotto (azioni, eventi). `size="lg"` per la vista da tavolo. */
import { Badge } from "../ui/Badge";
import { TeamLogo } from "../ui/TeamLogo";

interface Team { name: string; logo?: string; sub?: string }

interface Props {
  a: Team; b: Team;
  sa?: number | null; sb?: number | null; // null/undefined = partita non giocata
  done?: boolean;
  live?: boolean;
  label?: string;             // es. "Semifinale 1", "Girone A · Partita 3"
  center?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "lg";
  accent?: boolean;
  className?: string;
}

function TeamBlock({ t, side, size }: { t: Team; side: "a" | "b"; size: "sm" | "lg" }) {
  const align = side === "a" ? "items-end text-right sm:flex-row-reverse" : "items-start text-left";
  const nameCls = size === "lg" ? "text-2xl sm:text-3xl" : "text-base sm:text-lg";
  const logoCls = size === "lg" ? "h-10 w-10" : "h-6 w-6";
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 ${align}`}>
      <TeamLogo src={t.logo} className={`${logoCls} shrink-0`} />
      <div className="min-w-0">
        <div className={`font-display ${nameCls} truncate`}>{t.name}</div>
        {t.sub && <div className="text-[11px] text-chalk-muted truncate">{t.sub}</div>}
      </div>
    </div>
  );
}

export function ScoreCard({ a, b, sa, sb, done, live, label, center, footer, size = "sm", accent, className = "" }: Props) {
  // Vince chi ha più punti, solo a partita conclusa con tutti e due i punteggi
  let played = false;
  let aWins = false;
  let bWins = false;
  if (done && sa != null && sb != null) {
    played = true;
    aWins = sa > sb;
    bWins = sb > sa;
  }
  const scoreCls = size === "lg" ? "text-6xl sm:text-7xl" : "text-3xl";
  /** Il colore di un punteggio: chi vince in chalk, chi perde attenuato; a partita non giocata tutti e due neutri */
  const tone = (win: boolean) => {
    if (!played) return "text-chalk-muted";
    if (win) return "text-chalk";
    return "text-chalk-dim";
  };
  const accentCls = accent ? " border-t-[3px] border-t-court" : "";

  return (
    <div className={`rounded border border-asphalt-700 bg-asphalt-900${accentCls} ${className}`}>
      {(label || live) && (
        <div className="flex items-center justify-between gap-2 border-b border-asphalt-700 px-3 py-1.5">
          <span className="kicker truncate">{label}</span>
          {live && <Badge tone="live">Live</Badge>}
        </div>
      )}
      <div className={`flex items-center gap-3 ${size === "lg" ? "p-4 sm:p-6" : "px-3 py-2.5"}`}>
        <TeamBlock t={a} side="a" size={size} />
        {/* con uno slot centrale (input, clock) e nessun punteggio si mostra solo lo slot.
            Chi vince non si distingue solo dal colore (WCAG 1.4.1): «vince» segue il suo punteggio, solo per i lettori di schermo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {(sa != null || !center) && <span className={`font-display ${scoreCls} ${tone(aWins)} min-w-[1.2em] text-right`}>{sa ?? "–"}</span>}
          {aWins && <span className="sr-only">vince</span>}
          {center ?? <span className="font-display text-chalk-dim">–</span>}
          {(sb != null || !center) && <span className={`font-display ${scoreCls} ${tone(bWins)} min-w-[1.2em] text-left`}>{sb ?? "–"}</span>}
          {bWins && <span className="sr-only">vince</span>}
        </div>
        <TeamBlock t={b} side="b" size={size} />
      </div>
      {footer && <div className="border-t border-asphalt-700 px-3 py-2">{footer}</div>}
    </div>
  );
}
