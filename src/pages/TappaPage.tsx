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
import { LeaderboardSection } from "../components/leaderboard/LeaderboardSection";
import { VideoGrid } from "../components/video/VideoGrid";
import { VideoForm } from "../components/video/VideoForm";
import { ArchivioTappaView } from "../components/archivio/ArchivioTappaView";
import { INK, RED } from "../constants/colors";
import type { User } from "../types";

export function TappaPage() {
  const { id } = useParams();
  const h = useTappa(id);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

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

  /* tappa conclusa: vista pubblica + aggiunta video + riapertura */
  if (t.conclusa) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline", marginBottom: 12 }}>
          <span className="ui" style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: "8px 12px", fontWeight: 700, fontSize: 13 }}>
            🏁 Tappa conclusa e pubblicata nell'Archivio circuito: tutti gli utenti possono consultarla.
          </span>
          <span>
            <button onClick={() => navigate("/lega")} className="linkbtn">← Tutte le tappe</button>
            {" · "}
            <button onClick={() => h.riapri()} className="linkbtn" style={{ color: INK, opacity: 0.6 }}>Riapri per modifiche</button>
          </span>
        </div>
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `4px solid ${INK}`, paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 className="disp" style={{ fontSize: "clamp(20px, 5vw, 28px)", margin: 0, textTransform: "uppercase" }}>{t.nome}</h2>
          <span className="ui" style={{ fontSize: 13, fontWeight: 600 }}>
            {[t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre · {t.nGironi} gironi
          </span>
        </div>
        <span>
          <button onClick={() => navigate("/lega")} className="linkbtn">← Tutte le tappe</button>
          {" · "}
          <button onClick={() => setEditOpen(!editOpen)} className="linkbtn">{editOpen ? "Chiudi modifica" : "⚙ Modifica tappa"}</button>
          {" · "}
          <button onClick={() => { h.removeTappa(t.id); navigate("/lega"); }} className="linkbtn" style={{ color: INK, opacity: 0.55 }}>
            Elimina tappa
          </button>
        </span>
      </div>

      {editOpen && <TappaEditPanel h={h} />}

      <TappaRules regole={t.regole} onChange={h.setRule} />

      <h3 className="disp" style={{ fontSize: 16, margin: "18px 0 8px", textTransform: "uppercase" }}>Le squadre iscritte</h3>
      <p className="ui" style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 10px", color: RED }}>
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

      <LeaderboardSection tappa={t} />

      <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
        <h3 className="disp" style={{ fontSize: 18, margin: "12px 0 2px", textTransform: "uppercase" }}>Video della tappa</h3>
        <p className="ui" style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, margin: "0 0 10px" }}>
          Incolla i link delle riprese: i video di YouTube vengono incorporati, gli altri si aprono in una nuova scheda.
        </p>
        <VideoForm onAdd={h.addVideo} />
        <VideoGrid videos={t.video || []} onRemove={h.removeVideo} />
      </section>

      <TappaConclusion onConcludi={h.concludi} />
    </div>
  );
}
