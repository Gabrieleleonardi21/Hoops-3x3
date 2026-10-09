/** Card di una partita: gestisce tre stati — inserimento punteggi, vista risultato e
 *  log eventi. In modalità guest i controlli sui roster e la somma dei punti sono disattivati.
 *  È `memo` e riceve solo ciò che le serve (la partita, le sue due squadre, se l'utente è ospite e le azioni di useTappa, che sono
 *  stabili): così un tasto scritto in un'altra squadra, nelle regole o in un'altra partita non ridisegna le 112 schede di una
 *  tappa da 32 squadre (F11), ma solo quelle della squadra toccata, le cui prop cambiano. */
import { memo, useState } from "react";
import { ScoreCard } from "./ScoreCard";
import { ScoreInputs } from "./ScoreInputs";
import { StatsEditor, type SheetDraft } from "./StatsEditor";
import { StatsView } from "./StatsView";
import { EventLog } from "./EventLog";
import { EventForm } from "./EventForm";
import { Button } from "../ui/Button";
import type { Partita, SquadraTappa, StatLine } from "../../types";
import type { useTappa } from "../../hooks/useTappa";
import { giocatoriDi, logoSquadra, nomeGiocatore, nomeSquadra } from "../../utils/tappaInfo";
import { toStatLine } from "../../utils/statLine";

/** normalizza una scheda salvata (anche formato legacy) in bozza modificabile */
function toDraftSheet(sheet: Partita["pa"]): SheetDraft {
  return Object.fromEntries(
    Object.entries(sheet || {}).map(([pid, v]) => [
      pid,
      Object.fromEntries(Object.entries(toStatLine(v)).map(([k, n]) => [k, String(n)])),
    ])
  );
}

export const MatchCard = memo(function MatchCard({ m, squadraA, squadraB, guest, azioni, label }: {
  m: Partita;
  /** Le due squadre della partita, com'è ciascuna nella tappa (undefined se non si trova: dati incoerenti) */
  squadraA: SquadraTappa | undefined;
  squadraB: SquadraTappa | undefined;
  guest: boolean;
  azioni: ReturnType<typeof useTappa>["azioniPartita"];
  label?: string;
}) {
  const [draft, setDraft] = useState<SheetDraftConPunteggi>({
    sa: m.done ? String(m.sa) : "", sb: m.done ? String(m.sb) : "",
    pa: toDraftSheet(m.pa), pb: toDraftSheet(m.pb),
  });
  const [error, setError] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Le letture per id lavorano sulle sole due squadre della partita: gli stessi aiuti di tappaInfo, con lo stesso ripiego
  const squadre = [squadraA, squadraB].filter((s): s is SquadraTappa => s !== undefined);
  const nameOf = (teamId: string) => nomeSquadra(squadre, teamId);
  const playersOf = (teamId: string) => giocatoriDi(squadre, teamId);
  const playerNameById = (pid: string) => nomeGiocatore(squadre, pid);
  const logoOf = (teamId: string) => logoSquadra(squadre, teamId);

  const setSheet = (side: "pa" | "pb") => (pid: string, key: keyof StatLine, v: string) => {
    setDraft((d) => ({ ...d, [side]: { ...d[side], [pid]: { ...d[side][pid], [key]: v } } }));
    setError(null);
  };

  const save = () => setError(azioni.saveScore(m, draft));
  const eventi = m.eventi || [];
  const hasSheets = Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0;

  // Compatibilità con il formato legacy (solo punti come numero anziché oggetto StatLine)
  const ptOf = (raw: StatLine | number | undefined) => toStatLine(raw).pt ?? 0;

  /* Riepilogo punti per giocatore in una riga (solo a partita conclusa) */
  const summary = [[m.a, m.pa], [m.b, m.pb]]
    .map(([tid, pts]) =>
      pts && Object.keys(pts as object).length
        ? `${nameOf(tid as string)}: ` +
          playersOf(tid as string)
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
      labelA={nameOf(m.a)} labelB={nameOf(m.b)} />
  );

  const footer = (
    <div className="flex flex-col gap-2">
      {!m.done && (
        <div className="grid gap-2">
          <StatsEditor teamName={nameOf(m.a)} players={playersOf(m.a)} sheet={draft.pa} guest={guest} onChange={setSheet("pa")} />
          <StatsEditor teamName={nameOf(m.b)} players={playersOf(m.b)} sheet={draft.pb} guest={guest} onChange={setSheet("pb")} />
        </div>
      )}

      {m.done && hasSheets && (
        <>
          <p className="text-xs text-chalk-muted m-0">{summary}</p>
          {statsOpen && (
            <div className="grid gap-2 mt-1">
              {m.pa && Object.keys(m.pa).length > 0 && <StatsView teamName={nameOf(m.a)} players={playersOf(m.a)} sheet={m.pa} />}
              {m.pb && Object.keys(m.pb).length > 0 && <StatsView teamName={nameOf(m.b)} players={playersOf(m.b)} sheet={m.pb} />}
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
          <EventLog eventi={eventi} nameOf={nameOf} playerNameById={playerNameById}
            onRemove={(evId) => azioni.removeEvent(m.id, evId)} />
          <EventForm m={m} nameOf={nameOf} playersOf={playersOf} onAdd={(ev) => azioni.addEvent(m.id, ev)} />
        </div>
      )}

      {error && <p className="m-0 text-xs font-semibold text-loss" role="alert">{error}</p>}

      {/* Barra azioni: salva/correggi + toggle statistiche ed eventi */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {m.done ? (
          <Button variant="link" className="text-chalk-muted" onClick={() => setError(azioni.reopenScore(m.id))}>Correggi</Button>
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
      a={{ name: nameOf(m.a), logo: logoOf(m.a) }}
      b={{ name: nameOf(m.b), logo: logoOf(m.b) }}
      sa={m.done ? m.sa : null} sb={m.done ? m.sb : null}
      done={m.done} label={label} center={center} footer={footer}
    />
  );
});

/** La bozza della scheda: i due punteggi e i tabellini (MatchDraft di useTappa) */
type SheetDraftConPunteggi = Parameters<ReturnType<typeof useTappa>["saveScore"]>[1];
