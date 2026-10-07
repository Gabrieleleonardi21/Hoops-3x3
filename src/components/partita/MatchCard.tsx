/** Card di una partita: gestisce tre stati — inserimento punteggi, vista risultato e
 *  log eventi. In modalità guest i controlli sui roster e la somma dei punti sono disattivati. */
import { useState } from "react";
import { ScoreCard } from "./ScoreCard";
import { ScoreInputs } from "./ScoreInputs";
import { StatsEditor, type SheetDraft } from "./StatsEditor";
import { StatsView } from "./StatsView";
import { EventLog } from "./EventLog";
import { EventForm } from "./EventForm";
import { Button } from "../ui/Button";
import type { Partita, StatLine } from "../../types";
import type { MatchDraft, useTappa } from "../../hooks/useTappa";
import { logoSquadra } from "../../utils/tappaInfo";

/** normalizza una scheda salvata (anche formato legacy) in bozza modificabile */
function toDraftSheet(sheet: Partita["pa"]): SheetDraft {
  return Object.fromEntries(
    Object.entries(sheet || {}).map(([pid, v]) => [
      pid,
      typeof v === "object" && v !== null
        ? Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]))
        : { pt: String(v) },
    ])
  );
}

export function MatchCard({ m, h, label }: { m: Partita; h: ReturnType<typeof useTappa>; label?: string }) {
  const guest = !!h.user?.guest;
  const [draft, setDraft] = useState<MatchDraft>({
    sa: m.done ? String(m.sa) : "", sb: m.done ? String(m.sb) : "",
    pa: toDraftSheet(m.pa), pb: toDraftSheet(m.pb),
  });
  const [error, setError] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const setSheet = (side: "pa" | "pb") => (pid: string, key: keyof StatLine, v: string) => {
    setDraft((d) => ({ ...d, [side]: { ...d[side], [pid]: { ...d[side][pid], [key]: v } } }));
    setError(null);
  };

  const save = () => setError(h.saveScore(m, draft));
  const eventi = m.eventi || [];
  const hasSheets = Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0;

  // Compatibilità con il formato legacy (solo punti come numero anziché oggetto StatLine)
  const ptOf = (raw: StatLine | number | undefined) =>
    raw === undefined ? 0 : typeof raw === "object" ? raw.pt ?? 0 : raw;
  const logoOf = (id: string) => logoSquadra(h.tappa?.squadre, id);

  /* Riepilogo punti per giocatore in una riga (solo a partita conclusa) */
  const summary = [[m.a, m.pa], [m.b, m.pb]]
    .map(([tid, pts]) =>
      pts && Object.keys(pts as object).length
        ? `${h.nameOf(tid as string)}: ` +
          h.playersOf(tid as string)
            .filter((p) => (pts as Record<string, unknown>)[p.id] !== undefined)
            .map((p) => `${p.nome} ${ptOf((pts as Record<string, StatLine | number>)[p.id])}`)
            .join(", ")
        : null
    )
    .filter(Boolean)
    .join("  ·  ");

  /* Slot centrale: input punteggi finché la partita è aperta */
  const center = m.done ? undefined : (
    <ScoreInputs sa={draft.sa} sb={draft.sb}
      onSa={(v) => { setDraft({ ...draft, sa: v }); setError(null); }}
      onSb={(v) => { setDraft({ ...draft, sb: v }); setError(null); }}
      labelA={h.nameOf(m.a)} labelB={h.nameOf(m.b)} />
  );

  const footer = (
    <div className="flex flex-col gap-2">
      {!m.done && (
        <div className="grid gap-2">
          <StatsEditor teamName={h.nameOf(m.a)} players={h.playersOf(m.a)} sheet={draft.pa} guest={guest} onChange={setSheet("pa")} />
          <StatsEditor teamName={h.nameOf(m.b)} players={h.playersOf(m.b)} sheet={draft.pb} guest={guest} onChange={setSheet("pb")} />
        </div>
      )}

      {m.done && hasSheets && (
        <>
          <p className="text-xs text-chalk-muted m-0">{summary}</p>
          {statsOpen && (
            <div className="grid gap-2 mt-1">
              {m.pa && Object.keys(m.pa).length > 0 && <StatsView teamName={h.nameOf(m.a)} players={h.playersOf(m.a)} sheet={m.pa} />}
              {m.pb && Object.keys(m.pb).length > 0 && <StatsView teamName={h.nameOf(m.b)} players={h.playersOf(m.b)} sheet={m.pb} />}
            </div>
          )}
        </>
      )}

      {eventsOpen && (
        <div className="rounded border border-asphalt-700 bg-asphalt-950/60 p-2.5">
          {eventi.length === 0 && (
            <p className="m-0 mb-1.5 text-xs text-chalk-muted">
              Registra falli, sostituzioni, timeout, infortuni e qualsiasi altro evento della gara.
            </p>
          )}
          <EventLog eventi={eventi} nameOf={h.nameOf} playerNameById={h.playerNameById}
            onRemove={(evId) => h.removeEvent(m.id, evId)} />
          <EventForm m={m} nameOf={h.nameOf} playersOf={h.playersOf} onAdd={(ev) => h.addEvent(m.id, ev)} />
        </div>
      )}

      {error && <p className="m-0 text-xs font-semibold text-loss" role="alert">{error}</p>}

      {/* Barra azioni: salva/correggi + toggle statistiche ed eventi */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {m.done ? (
          <Button variant="link" className="text-chalk-muted" onClick={() => setError(h.reopenScore(m.id))}>Correggi</Button>
        ) : (
          <Button size="sm" onClick={save}>Salva risultato</Button>
        )}
        {m.done && hasSheets && (
          <Button variant="link" onClick={() => setStatsOpen(!statsOpen)}>
            {statsOpen ? "Nascondi statistiche" : "Statistiche complete"}
          </Button>
        )}
        <Button variant="link" onClick={() => setEventsOpen(!eventsOpen)}>
          {eventsOpen ? "Nascondi eventi" : `Eventi di gara (${eventi.length})`}
        </Button>
      </div>
    </div>
  );

  return (
    <ScoreCard
      a={{ name: h.nameOf(m.a), logo: logoOf(m.a) }}
      b={{ name: h.nameOf(m.b), logo: logoOf(m.b) }}
      sa={m.done ? m.sa : null} sb={m.done ? m.sb : null}
      done={m.done} label={label} center={center} footer={footer}
    />
  );
}
