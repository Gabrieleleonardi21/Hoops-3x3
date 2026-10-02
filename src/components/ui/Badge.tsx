/** Etichetta compatta: esito (W/L), LIVE, oro per il primo posto, neutra per i chip. */
type Tone = "live" | "win" | "loss" | "gold" | "court" | "neutral";

const tones: Record<Tone, string> = {
  live: "bg-live/15 text-live border-live/40",
  win: "bg-win/15 text-win border-win/40",
  loss: "bg-loss/15 text-loss border-loss/40",
  gold: "bg-gold/15 text-gold border-gold/40",
  court: "bg-court/15 text-court border-court/40",
  neutral: "bg-asphalt-800 text-chalk-muted border-asphalt-700",
};

export function Badge({ tone = "neutral", children, className = "" }: {
  tone?: Tone; children: React.ReactNode; className?: string;
}) {
  const pill = tone === "live" ? " rounded-full" : " rounded-sm";
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${tones[tone]}${pill} ${className}`}>
      {/* puntino pulsante solo per LIVE */}
      {tone === "live" && <span className="w-1.5 h-1.5 rounded-full bg-live pulse" aria-hidden="true" />}
      {children}
    </span>
  );
}
