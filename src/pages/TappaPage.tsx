/** Pagina di gestione di una tappa: mostra due viste distinte —
 *  in modifica (squadre, sorteggio, gironi, statistiche, video)
 *  oppure sola-lettura se la tappa è già conclusa e pubblicata. */
import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";
import { Section } from "../components/ui/Section";
import { Badge } from "../components/ui/Badge";

export function TappaPage() {
  const { id } = useParams();
  const h = useTappa(id);
  const navigate = useNavigate();
  const [editOpen,    setEditOpen]    = useState(false);
  const [timerOpen,   setTimerOpen]   = useState(false);
  const [shareOpen,   setShareOpen]   = useState(false);
  const [copied,      setCopied]      = useState(false);

  // useAnagrafe deve stare prima degli early return (regole degli hook)
  const { squadre: squadreAnagrafe, saveSquadra, trovaSquadra } = useAnagrafe();

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

    // Prima in cache, poi sul server: un altro utente può averla registrata dopo il caricamento
    // della cache e non va creato un doppione nell'anagrafe condivisa
    const existing = await trovaSquadra(trimmed);
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <Badge tone="win"><Icon name="flag" size={11} /> Conclusa e pubblicata nell'archivio</Badge>
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/lega")}><Icon name="arrowLeft" size={14} /> Tutte le tappe</Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen((o) => !o)}><Icon name="share" size={14} /> Condividi</Button>
            <Button variant="ghost" size="sm" onClick={() => h.riapri()}>Riapri</Button>
          </span>
        </div>

        {/* Pannello condivisione link pubblico */}
        {shareOpen && (
          <Card className="mb-3">
            <div className="kicker mb-1.5">Link pubblico — chiunque può consultare questa tappa</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[200px] break-all rounded-sm border border-asphalt-700 bg-asphalt-950 px-2.5 py-1.5 text-[13px] text-chalk">{publicUrl}</code>
              <Button size="sm" onClick={copyLink}>{copied ? "Copiato!" : "Copia link"}</Button>
            </div>
          </Card>
        )}

        <Card className="mb-4"><VideoForm compact onAdd={h.addVideo} /></Card>
        <ArchivioTappaView t={t} lega={h.legaName} autore={h.user.name} />
      </div>
    );
  }

  /* organizzazione */
  const done = t.partite.filter((m) => m.done).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-asphalt-700 pb-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Link to="/lega" className="inline-flex items-center gap-1 text-[13px] text-chalk-muted hover:text-chalk"><Icon name="arrowLeft" size={14} /> Tutte le tappe</Link>
            {t.gironi && done > 0 && done < t.partite.length && <Badge tone="live">In corso</Badge>}
          </div>
          <h1 className="font-display text-[clamp(28px,5vw,44px)] text-chalk">{t.nome}</h1>
          <span className="text-[13px] text-chalk-muted">
            {[t.luogo, t.data, `${t.squadre.length} squadre`, `${t.nGironi} gironi`, t.gironi ? `${done}/${t.partite.length} gare` : ""].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(!editOpen)}><Icon name="edit" size={14} /> {editOpen ? "Chiudi modifica" : "Modifica"}</Button>
          <Button variant="outline" size="sm" onClick={() => setTimerOpen(true)}><Icon name="timer" size={14} /> Timer</Button>
          <Button variant="ghost" size="sm" onClick={() => { h.removeTappa(t.id); navigate("/lega"); }}><Icon name="trash" size={14} /> Elimina</Button>
        </span>
      </div>

      {editOpen && <TappaEditPanel h={h} />}

      <TappaRules regole={t.regole} onChange={h.setRule} />

      <Section title="Le squadre iscritte" kicker={`${t.squadre.length} squadre`}>
        <p className="mb-3 text-[13px] text-chalk-muted">
          Ogni squadra deve inserire i propri giocatori (minimo 3, massimo 4): senza roster completi non si possono sorteggiare i gironi.
          {h.user.guest ? " In modalità Ospite il controllo è disattivato per le prove." : ""}
        </p>
        <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {t.squadre.map((s, i) => (
            <SquadraCard key={s.id} s={s} index={i} h={h}
              onNameCommit={(nome) => handleTeamNameCommit(s.id, nome)} />
          ))}
        </div>
        <SorteggioControls hasGironi={!!t.gironi} onSorteggia={h.sorteggia} perdita={h.perditaRisultati} />
      </Section>

      {t.gironi && t.gironi.map((g, gi) => <GironeSection key={gi} gi={gi} girone={g} h={h} />)}

      {/* Fase a eliminazione diretta: compare quando tutti i gironi sono conclusi */}
      {t.gironi && <BracketSection tappa={t} />}

      <LeaderboardSection tappa={t} />

      <Section title="Video della tappa" kicker="YouTube incorporato · altri link in nuova scheda">
        <VideoForm onAdd={h.addVideo} />
        <VideoGrid videos={t.video || []} onRemove={h.removeVideo} />
      </Section>

      <TappaConclusion onConcludi={h.concludi} />

      {timerOpen && <MatchTimer onClose={() => setTimerOpen(false)} />}
    </div>
  );
}
