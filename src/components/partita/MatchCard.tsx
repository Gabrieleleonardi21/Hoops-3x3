/** Card di una partita: gestisce tre stati — inserimento punteggi, vista risultato e
 *  log eventi. In modalità guest i controlli sui roster e la somma dei punti sono disattivati. */
import { useState } from "react";
import { INK, RED, RULE } from "../../constants/colors";
import { ScoreInputs } from "./ScoreInputs";
import { StatsEditor, type SheetDraft } from "./StatsEditor";
import { StatsView } from "./StatsView";
import { EventLog } from "./EventLog";
import { EventForm } from "./EventForm";
import type { Partita, StatLine } from "../../types";
import type { MatchDraft, useTappa } from "../../hooks/useTappa";

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

export function MatchCard({ m, h }: { m: Partita; h: ReturnType<typeof useTappa> }) {
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

  return (
    <div style={{ borderBottom: `1px dotted ${RULE}`, padding: "10px 0" }}>
      <div className="row gap-10 wrap">
        <span className="disp tar" style={{ fontSize: 14, flex: "1 1 150px" }}>{h.nameOf(m.a)}</span>
        {m.done ? (
          <span className="disp tac" style={{ fontSize: 20, minWidth: 90 }}>
            <span style={{ color: m.sa > m.sb ? INK : RED }}>{m.sa}</span>
            {" - "}
            <span style={{ color: m.sb > m.sa ? INK : RED }}>{m.sb}</span>
          </span>
        ) : (
          <ScoreInputs sa={draft.sa} sb={draft.sb}
            onSa={(v) => { setDraft({ ...draft, sa: v }); setError(null); }}
            onSb={(v) => { setDraft({ ...draft, sb: v }); setError(null); }}
            labelA={h.nameOf(m.a)} labelB={h.nameOf(m.b)} />
        )}
        <span className="disp" style={{ fontSize: 14, flex: "1 1 150px" }}>{h.nameOf(m.b)}</span>
        {m.done ? (
          <button onClick={() => h.reopenScore(m.id)} className="linkbtn t-ink" style={{ opacity: 0.55 }}>Correggi</button>
        ) : (
          <button onClick={save} className="blackbtn" style={{ padding: "8px 14px", fontSize: 12.5 }}>Salva</button>
        )}
      </div>

      {!m.done && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, margin: "10px 0 2px" }}>
          <StatsEditor teamName={h.nameOf(m.a)} players={h.playersOf(m.a)} sheet={draft.pa} guest={guest} onChange={setSheet("pa")} />
          <StatsEditor teamName={h.nameOf(m.b)} players={h.playersOf(m.b)} sheet={draft.pb} guest={guest} onChange={setSheet("pb")} />
        </div>
      )}

      {m.done && hasSheets && (
        <>
          <p className="ui" style={{ fontSize: 12.5, margin: "6px 0 0", opacity: 0.85 }}>
            {[[m.a, m.pa], [m.b, m.pb]]
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
              .join("  ·  ")}
          </p>
          <div style={{ marginTop: 4 }}>
            <button className="linkbtn" style={{ fontSize: 12 }} onClick={() => setStatsOpen(!statsOpen)}>
              {statsOpen ? "− Nascondi statistiche complete" : "+ Statistiche complete"}
            </button>
          </div>
          {statsOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
              {m.pa && Object.keys(m.pa).length > 0 && <StatsView teamName={h.nameOf(m.a)} players={h.playersOf(m.a)} sheet={m.pa} />}
              {m.pb && Object.keys(m.pb).length > 0 && <StatsView teamName={h.nameOf(m.b)} players={h.playersOf(m.b)} sheet={m.pb} />}
            </div>
          )}
        </>
      )}

      {/* eventi di gara */}
      <div style={{ marginTop: 6 }}>
        <button className="linkbtn" style={{ fontSize: 12 }} onClick={() => setEventsOpen(!eventsOpen)}>
          {eventsOpen ? "− Nascondi eventi di gara" : `+ Eventi di gara (${eventi.length})`}
        </button>
        {eventsOpen && (
          <div style={{ background: "var(--card)", border: `1px solid ${RULE}`, padding: 10, marginTop: 6 }}>
            {eventi.length === 0 && (
              <p className="ui" style={{ fontSize: 12, fontStyle: "italic", margin: "0 0 6px", opacity: 0.7, fontWeight: 600 }}>
                Registra falli, sostituzioni, timeout, infortuni e qualsiasi altro evento della gara.
              </p>
            )}
            <EventLog eventi={eventi} nameOf={h.nameOf} playerNameById={h.playerNameById}
              onRemove={(evId) => h.removeEvent(m.id, evId)} />
            <EventForm m={m} nameOf={h.nameOf} playersOf={h.playersOf} onAdd={(ev) => h.addEvent(m.id, ev)} />
          </div>
        )}
      </div>

      {error && <p className="ui t-red tac" style={{ fontWeight: 700, fontSize: 12.5, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
