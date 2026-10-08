/** Pagina di gestione di una tappa: mostra due viste distinte —
 *  in modifica (squadre, sorteggio, gironi, statistiche, video)
 *  oppure sola-lettura se la tappa è già conclusa e pubblicata. */
import { useState, useEffect, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTappa } from "../hooks/useTappa";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { useConfermaPerdita } from "../hooks/useConfermaPerdita";
import { useInvio } from "../hooks/useInvio";
import { eSegnaposto } from "../domain/tappaOps";
import { testoErrore } from "../services/api";
import { COPIA_LINK_NON_RIUSCITA, copiaPubblicaNonAggiornata, tappaNonPubblicata } from "../utils/testi";
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
import { useUtente } from "../hooks/useUtente";
import { MAX_ROSTER, MIN_ROSTER } from "../constants/rules";

/** Riga d'errore sopra il contenuto della tappa: role="alert", così il lettore di schermo la annuncia appena compare */
function Avviso({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[13px] font-semibold text-loss" role="alert">{children}</p>;
}

export function TappaPage() {
  const { id } = useParams();
  const h = useTappa(id);
  const user = useUtente();
  const navigate = useNavigate();
  const [editOpen,    setEditOpen]    = useState(false);
  const [timerOpen,   setTimerOpen]   = useState(false);
  const [shareOpen,   setShareOpen]   = useState(false);
  const [copied,      setCopied]      = useState(false);
  // Perché il link non si è copiato (appunti non disponibili o permesso negato): compare sotto il link
  const { errore: erroreCopia, setErrore: setErroreCopia } = useInvio();
  // Squadre che non si sono potute collegare all'anagrafe: id della squadra → perché (null = nessun problema). Il motivo compare
  // nella card, sotto il nome: la squadra resta com'è e si usa lo stesso nella tappa
  const [erroriAnagrafe, setErroriAnagrafe] = useState<Record<string, string | null>>({});

  // useAnagrafe deve stare prima degli early return (regole degli hook)
  const { squadre: squadreAnagrafe, errore: erroreCaricamento, saveSquadra, trovaSquadra } = useAnagrafe();
  // «Elimina» e «Riapri» chiedono conferma: ognuno ha la sua finestra, mostrata nella vista in cui il pulsante compare
  const elimina = useConfermaPerdita(h.perditaTappa);
  const riapri = useConfermaPerdita(h.perditaRiapertura);
  // «Riapri» toglie la pubblicazione dal server: finché aspetta il pulsante è disattivato e, se non riesce, l'errore compare qui
  const riapertura = useInvio();

  // Quando l'anagrafe carica, sincronizza le squadre della tappa (per nome o regId)
  useEffect(() => {
    if (!squadreAnagrafe) return;
    void h.syncFromAnagrafe(squadreAnagrafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadreAnagrafe]);

  if (!h.tappa) return <Navigate to="/lega" replace />;
  const t = h.tappa;

  const segnaErroreAnagrafe = (teamId: string, motivo: string | null) =>
    setErroriAnagrafe((errori) => ({ ...errori, [teamId]: motivo }));

  /** Chiamato dall'input nome della squadra onBlur.
   *  Se il nome è reale (non placeholder), cerca o crea la RegSquadra nell'anagrafe e collega. */
  const handleTeamNameCommit = async (teamId: string, nome: string) => {
    // Il messaggio di un tentativo precedente si toglie subito, anche se questo non parte (nome vuoto o segnaposto, squadra già
    // collegata): resterebbe un «Riprova» che non può fare niente, su un nome che non c'è più
    segnaErroreAnagrafe(teamId, null);
    const trimmed = nome.trim();
    if (!h.user || h.user.guest || !trimmed || eSegnaposto(trimmed)) return;
    // Si aspetta solo mentre l'anagrafe si sta caricando. Se il caricamento è fallito (liste ancora null, `erroreCaricamento` pieno)
    // si prova lo stesso: trovaSquadra funziona anche con la cache vuota, guarda sul server, e un rifiuto compare nella card
    if (!squadreAnagrafe && !erroreCaricamento) return;
    const s = h.tappa?.squadre.find((x) => x.id === teamId);
    if (!s || s.regId) return; // già collegata, niente da fare

    try {
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
    } catch (e) {
      // Chiamata dal campo del nome (onBlur), dove nessuno aspetta la promessa: se non si prende qui l'errore va perso, e l'utente
      // non sa che la squadra non è collegata all'anagrafe
      segnaErroreAnagrafe(teamId, `Squadra «${trimmed}» non collegata all'anagrafe: ${testoErrore(e)}`);
    }
  };

  /* URL pubblico della tappa (navigabile anche senza login) */
  const publicUrl = `${window.location.origin}/tappa/${t.id}`;
  const copyLink  = async () => {
    setErroreCopia(null);
    try {
      // Su http fuori da localhost navigator.clipboard non esiste: l'accesso stesso lancia, come un permesso negato
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      setErroreCopia(COPIA_LINK_NON_RIUSCITA);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  let etichettaCopia = "Copia link";
  if (copied) etichettaCopia = "Copiato!";

  /* tappa conclusa: vista pubblica + aggiunta video + riapertura */
  if (t.conclusa) {
    // «Pubblicata» solo se lo è davvero: l'esito della pubblicazione e la verifica con l'archivio sono nello stato dell'hook. Se
    // non si sa (verifica in corso o non riuscita, ospite) la pagina dice solo che la tappa è conclusa
    const { pubblicata, errore } = h.statoArchivio;
    let badge = <Badge><Icon name="flag" size={11} /> Conclusa</Badge>;
    if (pubblicata === true) badge = <Badge tone="win"><Icon name="flag" size={11} /> Conclusa e pubblicata nell'archivio</Badge>;
    if (pubblicata === false) badge = <Badge tone="loss"><Icon name="flag" size={11} /> Conclusa, non pubblicata</Badge>;
    // Tre avvisi diversi: in archivio ma non aggiornata (video), non pubblicata, oppure verificata come assente
    let avvisoArchivio: string | null = null;
    if (errore && pubblicata === true) avvisoArchivio = copiaPubblicaNonAggiornata(errore);
    else if (errore || pubblicata === false) avvisoArchivio = tappaNonPubblicata(errore);
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          {badge}
          {/* comandi della pagina: in stampa non servono (index.css nasconde solo .no-print) */}
          <span className="no-print flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/lega")}><Icon name="arrowLeft" size={14} /> Tutte le tappe</Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen((o) => !o)}><Icon name="share" size={14} /> Condividi</Button>
            <Button variant="ghost" size="sm" disabled={riapertura.invio || h.pubblicando}
              onClick={() => riapri.chiedi("Riaprire la tappa?", () => { void riapertura.esegui(() => h.riapri(), "Riapertura non riuscita, la tappa resta conclusa"); })}>
              Riapri
            </Button>
          </span>
        </div>
        {avvisoArchivio && <Avviso>{avvisoArchivio}</Avviso>}
        {riapertura.errore && <Avviso>{riapertura.errore}</Avviso>}

        {/* Pannello condivisione link pubblico */}
        {shareOpen && (
          <Card className="no-print mb-3">
            <div className="kicker mb-1.5">Link pubblico — chiunque può consultare questa tappa</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[200px] break-all rounded-sm border border-asphalt-700 bg-asphalt-950 px-2.5 py-1.5 text-[13px] text-chalk">{publicUrl}</code>
              <Button size="sm" onClick={() => { void copyLink(); }}>{etichettaCopia}</Button>
            </div>
            {erroreCopia && <p className="m-0 mt-1.5 text-xs font-semibold text-loss" role="alert">{erroreCopia}</p>}
          </Card>
        )}

        <Card className="no-print mb-4"><VideoForm compact onAdd={h.addVideo} /></Card>
        <ArchivioTappaView t={t} lega={h.legaName} autore={user.name} />
        {riapri.finestra}
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
          <Button variant="ghost" size="sm" onClick={() => elimina.chiedi("Eliminare la tappa?", () => { h.removeTappa(t.id); navigate("/lega"); })}>
            <Icon name="trash" size={14} /> Elimina
          </Button>
        </span>
      </div>

      {editOpen && <TappaEditPanel h={h} />}

      <TappaRules regole={t.regole} onChange={h.setRule} />

      <Section title="Le squadre iscritte" kicker={`${t.squadre.length} squadre`}>
        <p className="mb-3 text-[13px] text-chalk-muted">
          Ogni squadra deve inserire i propri giocatori (minimo {MIN_ROSTER}, massimo {MAX_ROSTER}): senza roster completi non si possono sorteggiare i gironi.
          {user.guest && " In modalità Ospite il controllo è disattivato per le prove."}
        </p>
        <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {t.squadre.map((s, i) => (
            <SquadraCard key={s.id} s={s} index={i} h={h} erroreAnagrafe={erroriAnagrafe[s.id]}
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

      {timerOpen && <MatchTimer regole={t.regole} onClose={() => setTimerOpen(false)} />}
      {elimina.finestra}
    </div>
  );
}
