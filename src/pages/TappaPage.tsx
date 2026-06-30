/** Pagina di gestione di una tappa: mostra due viste distinte —
 *  in modifica (squadre, sorteggio, gironi, statistiche, video)
 *  oppure sola-lettura se la tappa è già conclusa e pubblicata. */
import { useState, useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTappa } from "../hooks/useTappa";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { TappaEditPanel } from "../components/tappa/TappaEditPanel";
import { TappaRules } from "../components/tappa/TappaRules";
import { TappaConclusion } from "../components/tappa/TappaConclusion";
import { SquadraCard } from "../components/squadra/SquadraCard";
import { SorteggioControls } from "../components/gironi/SorteggioControls";
import { GironeSection } from "../components/gironi/GironeSection";
import { BracketSection } from "../components/gironi/BracketSection";
import { LeaderboardSection } from "../components/leaderboard/LeaderboardSection";
import { VideoGrid } from "../components/video/VideoGrid";
import { VideoForm } from "../components/video/VideoForm";
import { ArchivioTappaView } from "../components/archivio/ArchivioTappaView";
import { MatchTimer } from "../components/partita/MatchTimer";
import { INK, RULE } from "../constants/colors";
import type { User } from "../types";

export function TappaPage() {
  const { id } = useParams();
  const h = useTappa(id);
  const navigate = useNavigate();
  const [editOpen,    setEditOpen]    = useState(false);
  const [timerOpen,   setTimerOpen]   = useState(false);
  const [shareOpen,   setShareOpen]   = useState(false);
  const [copied,      setCopied]      = useState(false);

  // useAnagrafe deve stare prima degli early return (regole degli hook)
  const dummyUser: User = { name: "", guest: true };
  const { squadre: squadreAnagrafe, saveSquadra } = useAnagrafe(h.user ?? dummyUser);

  // Quando l'anagrafe carica, sincronizza le squadre della tappa (per nome o regId)
  useEffect(() => {
    if (!squadreAnagrafe) return;
    h.syncFromAnagrafe(squadreAnagrafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadreAnagrafe]);

  if (!h.user) return <Navigate to="/" replace />;
  if (!h.tappa) return <Navigate to="/lega" replace />;
  const t = h.tappa;

  /** Chiamato dall'input nome della squadra onBlur.
   *  Se il nome è reale (non placeholder), cerca o crea la RegSquadra nell'anagrafe e collega. */
  const handleTeamNameCommit = async (teamId: string, nome: string) => {
    const trimmed = nome.trim();
    if (!h.user || h.user.guest || !trimmed || /^Squadra \d+$/.test(trimmed)) return;
    if (!squadreAnagrafe) return;
    const s = h.tappa?.squadre.find((x) => x.id === teamId);
    if (!s || s.regId) return; // già collegata, niente da fare

    const existing = squadreAnagrafe.find((r) => r.nome.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      h.applyReg(teamId, existing);
    } else {
      // Crea una nuova RegSquadra nell'anagrafe e collega subito
      const newReg = await saveSquadra({
        nome: trimmed, citta: "", anno: "", rank: String(s.rank || ""),
        referente: "", roster: [], logo: s.logo || "", website: s.website || "",
        instagram: "", note: "",
      });
      h.applyReg(teamId, newReg);
    }
  };

  /* URL pubblico della tappa (navigabile anche senza login) */
  const publicUrl = `${window.location.origin}/tappa/${t.id}`;
  const copyLink  = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* tappa conclusa: vista pubblica + aggiunta video + riapertura */
  if (t.conclusa) {
    return (
      <div>
        <div className="flex between gap-10 wrap items-base" style={{ marginBottom: 12 }}>
          <span className="ui" style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: "8px 12px", fontWeight: 700, fontSize: 13 }}>
            Tappa conclusa e pubblicata nell'Archivio circuito.
          </span>
          <span className="flex gap-8 wrap">
            <button onClick={() => navigate("/lega")} className="linkbtn">← Tutte le tappe</button>
            <button onClick={() => setShareOpen((o) => !o)} className="linkbtn">Condividi</button>
            <button onClick={() => h.riapri()} className="linkbtn t-ink" style={{ opacity: 0.6 }}>Riapri</button>
          </span>
        </div>

        {/* Pannello condivisione link pubblico */}
        {shareOpen && (
          <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12, marginBottom: 12 }}>
            <div className="kicker" style={{ fontSize: 11, marginBottom: 6 }}>
              Link pubblico — chiunque può consultare questa tappa
            </div>
            <div className="row gap-8 wrap">
              <code style={{ fontSize: 13, background: "var(--paper)", padding: "6px 10px", border: `1px solid ${RULE}`, flex: "1 1 200px", wordBreak: "break-all" }}>
                {publicUrl}
              </code>
              <button onClick={copyLink} className="blackbtn" style={{ padding: "8px 14px", fontSize: 12 }}>
                {copied ? "Copiato!" : "Copia link"}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12, margin: "0 0 18px" }}>
          <VideoForm compact onAdd={h.addVideo} />
        </div>
        <ArchivioTappaView t={t} lega={h.legaName} autore={h.user.name} />
      </div>
    );
  }

  /* organizzazione */
  return (
    <div>
      <div className="flex between items-base wrap gap-8" style={{ borderBottom: `4px solid ${INK}`, paddingBottom: 10 }}>
        <div>
          <h2 className="disp up" style={{ fontSize: "clamp(20px, 5vw, 28px)", margin: 0 }}>{t.nome}</h2>
          <span className="ui" style={{ fontSize: 13, fontWeight: 600 }}>
            {[t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre · {t.nGironi} gironi
          </span>
        </div>
        <span className="flex gap-6 wrap">
          <button onClick={() => navigate("/lega")} className="linkbtn">← Tutte le tappe</button>
          {" · "}
          <button onClick={() => setEditOpen(!editOpen)} className="linkbtn">{editOpen ? "Chiudi modifica" : "⚙ Modifica"}</button>
          {" · "}
          <button onClick={() => setTimerOpen(true)} className="linkbtn">Timer</button>
          {" · "}
          <button onClick={() => { h.removeTappa(t.id); navigate("/lega"); }} className="linkbtn t-ink" style={{ opacity: 0.55 }}>
            Elimina
          </button>
        </span>
      </div>

      {editOpen && <TappaEditPanel h={h} />}

      <TappaRules regole={t.regole} onChange={h.setRule} />

      <h3 className="disp up" style={{ fontSize: 16, margin: "18px 0 8px" }}>Le squadre iscritte</h3>
      <p className="ui t-red" style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 10px" }}>
        Ogni squadra deve inserire i propri giocatori (minimo 3, massimo 4): senza roster completi non si possono sorteggiare i gironi.
        {h.user.guest ? " In modalità Ospite il controllo è disattivato per le prove." : ""}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
        {t.squadre.map((s, i) => (
          <SquadraCard key={s.id} s={s} index={i} h={h}
            onNameCommit={(nome) => handleTeamNameCommit(s.id, nome)} />
        ))}
      </div>

      <SorteggioControls hasGironi={!!t.gironi} onSorteggia={h.sorteggia} />

      {t.gironi && t.gironi.map((g, gi) => <GironeSection key={gi} gi={gi} girone={g} h={h} />)}

      {/* Fase a eliminazione diretta: compare quando tutti i gironi sono conclusi */}
      {t.gironi && <BracketSection tappa={t} />}

      <LeaderboardSection tappa={t} />

      <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
        <h3 className="disp up" style={{ fontSize: 18, margin: "12px 0 2px" }}>Video della tappa</h3>
        <p className="ui" style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, margin: "0 0 10px" }}>
          Incolla i link delle riprese: i video di YouTube vengono incorporati, gli altri si aprono in una nuova scheda.
        </p>
        <VideoForm onAdd={h.addVideo} />
        <VideoGrid videos={t.video || []} onRemove={h.removeVideo} />
      </section>

      <TappaConclusion onConcludi={h.concludi} />

      {timerOpen && <MatchTimer onClose={() => setTimerOpen(false)} />}
    </div>
  );
}
