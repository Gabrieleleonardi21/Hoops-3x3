import { useState } from "react";
import { INK, ORANGE, RED, RULE } from "../../constants/colors";
import { standings } from "../../utils/standings";
import { ClassificaTable } from "../gironi/ClassificaTable";
import { StatsView } from "../partita/StatsView";
import { EventLog } from "../partita/EventLog";
import { LeaderboardSection } from "../leaderboard/LeaderboardSection";
import { VideoGrid } from "../video/VideoGrid";
import { GiocatoreAnalisi } from "./GiocatoreAnalisi";
import type { Tappa } from "../../types";

/** Vista in sola lettura di una tappa: tappe concluse e archivio del circuito */
export function ArchivioTappaView({ t, lega, autore }: { t: Tappa; lega?: string; autore?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [selPid, setSelPid] = useState<string | null>(null);
  const hasStats = t.partite.some((m) => m.done && (Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0));
  const nameOf = (id: string) => t.squadre.find((s) => s.id === id)?.nome || "?";
  const playersOf = (teamId: string) =>
    (t.squadre.find((s) => s.id === teamId)?.giocatori || []).filter((p) => p.nome.trim());
  const playerNameById = (pid: string) => {
    for (const s of t.squadre) {
      const p = (s.giocatori || []).find((x) => x.id === pid);
      if (p) return p.nome;
    }
    return null;
  };

  return (
    <div>
      <div style={{ borderBottom: `4px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
        <h2 className="disp" style={{ fontSize: "clamp(20px, 5vw, 28px)", margin: 0, textTransform: "uppercase" }}>{t.nome}</h2>
        <span className="ui" style={{ fontSize: 13, fontWeight: 600 }}>
          {[lega, t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre
          {autore ? ` · organizzata da ${autore}` : ""}
        </span>
      </div>

      <h3 className="disp" style={{ fontSize: 16, margin: "0 0 2px", textTransform: "uppercase" }}>Squadre e roster</h3>
      {hasStats && (
        <p className="ui" style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, margin: "0 0 8px" }}>
          Clicca un giocatore per vedere su cosa deve migliorare e gli esercizi consigliati.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 18 }}>
        {t.squadre.map((s) => (
          <div key={s.id} style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 10 }}>
            <div className="disp" style={{ fontSize: 13.5, textTransform: "uppercase" }}>{s.nome}</div>
            {Number(s.rank) > 0 && (
              <div className="ui" style={{ fontSize: 10.5, fontWeight: 700, color: ORANGE }}>Ranking circuito: {s.rank}</div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {(s.giocatori || []).filter((p) => p.nome.trim()).map((p) => (
                <button key={p.id} onClick={() => setSelPid(p.id)} className="ui"
                  title={`Analisi di ${p.nome}`}
                  style={{ background: "transparent", border: `1px solid ${INK}`, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: INK }}>
                  {p.nome} <span style={{ color: ORANGE }}>▸</span>
                </button>
              ))}
              {(s.giocatori || []).filter((p) => p.nome.trim()).length === 0 && (
                <span className="ui" style={{ fontSize: 12.5 }}>—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {t.gironi && t.gironi.map((g, gi) => {
        const matches = t.partite.filter((m) => m.g === gi);
        const rows = standings(g, matches, nameOf);
        return (
          <section key={gi} style={{ borderTop: `4px solid ${INK}`, marginBottom: 22 }}>
            <h3 className="disp" style={{ fontSize: 18, margin: "12px 0 8px", textTransform: "uppercase" }}>
              Girone {String.fromCharCode(65 + gi)}
            </h3>
            {matches.map((m) => {
              const hasDetails =
                Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0 || (m.eventi || []).length > 0;
              return (
                <div key={m.id} style={{ borderBottom: `1px dotted ${RULE}`, padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span className="disp" style={{ fontSize: 14, flex: "1 1 140px", textAlign: "right" }}>{nameOf(m.a)}</span>
                    <span className="disp" style={{ fontSize: 19, minWidth: 86, textAlign: "center" }}>
                      <span style={{ color: m.sa > m.sb ? INK : RED }}>{m.sa}</span>
                      {" - "}
                      <span style={{ color: m.sb > m.sa ? INK : RED }}>{m.sb}</span>
                    </span>
                    <span className="disp" style={{ fontSize: 14, flex: "1 1 140px" }}>{nameOf(m.b)}</span>
                  </div>
                  {hasDetails && (
                    <div style={{ textAlign: "center", marginTop: 2 }}>
                      <button className="linkbtn" style={{ fontSize: 12 }} onClick={() => setOpen(open === m.id ? null : m.id)}>
                        {open === m.id ? "− Nascondi dettagli" : "+ Statistiche ed eventi"}
                      </button>
                    </div>
                  )}
                  {open === m.id && (
                    <div style={{ marginTop: 6 }}>
                      {m.pa && Object.keys(m.pa).length > 0 && <StatsView teamName={nameOf(m.a)} players={playersOf(m.a)} sheet={m.pa} />}
                      {m.pb && Object.keys(m.pb).length > 0 && <StatsView teamName={nameOf(m.b)} players={playersOf(m.b)} sheet={m.pb} />}
                      {(m.eventi || []).length > 0 && (
                        <div className="ui" style={{ fontSize: 12.5 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "4px 0" }}>
                            Eventi di gara
                          </div>
                          <EventLog eventi={m.eventi || []} nameOf={nameOf} playerNameById={playerNameById} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <ClassificaTable rows={rows} />
          </section>
        );
      })}

      <LeaderboardSection tappa={t} />

      <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 10 }}>
        <h3 className="disp" style={{ fontSize: 18, margin: "12px 0 8px", textTransform: "uppercase" }}>Video della tappa</h3>
        <VideoGrid videos={t.video || []} />
      </section>

      {selPid && <GiocatoreAnalisi tappa={t} pid={selPid} onClose={() => setSelPid(null)} />}
    </div>
  );
}
