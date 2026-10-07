/** Radice dell'applicazione: configura il router e inserisce Coach AI (FAB + pannello)
 *  fuori dal flusso di pagine così resta visibile su tutte le rotte. */
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAppStore } from "./stores/useAppStore";
import { useAnagrafeStore } from "./stores/useAnagrafeStore";
import { useAuth, saveSession } from "./hooks/useAuth";
import * as authService from "./services/authService";
import { avviaRinnovoAutomatico, suSessioneCambiataAltrove, suSessioneFinita } from "./services/api";
import { Header } from "./components/layout/Header";
import { SyncBanner } from "./components/layout/SyncBanner";
import { Loading } from "./components/ui/Loading";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { ErroreCaricamento } from "./components/ui/ErroreCaricamento";
import { CoachFAB } from "./components/coach/CoachFAB";
import { CoachPanel } from "./components/coach/CoachPanel";
import { HomePage } from "./pages/HomePage";
import { LegheListPage } from "./pages/LegheListPage";
import { LegaPage } from "./pages/LegaPage";
import { TappaPage } from "./pages/TappaPage";
import { TappaViewPage } from "./pages/TappaViewPage";
import { AnagrafePage } from "./pages/AnagrafePage";
import { ArchivioPage } from "./pages/ArchivioPage";
import { GiocatorePage } from "./pages/GiocatorePage";
import { CampettiPage } from "./pages/CampettiPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import type { User } from "./types";

/** Messaggio del form di accesso quando la sessione finisce: dice anche quante tappe avevano modifiche che non è
 *  stato più possibile salvare, così nessuna si perde in silenzio */
function messaggioFineSessione(nonSalvate: number): string {
  const testo = "Sessione scaduta: accedi di nuovo";
  if (nonSalvate === 0) return testo;
  if (nonSalvate === 1) return `${testo}. 1 tappa aveva modifiche non salvate.`;
  return `${testo}. ${nonSalvate} tappe avevano modifiche non salvate.`;
}

/** Sessione dell'utente registrato, per tutta la vita della pagina:
 *  - fine della sessione (rinnovo respinto, token cancellato da un'altra scheda, sessione scaduta all'avvio): uscita
 *    senza conferma, perché salvare non è più possibile, e ritorno al form con il messaggio;
 *  - accesso o uscita in un'altra scheda (il token compare o sparisce): la cache dell'anagrafe si svuota, perché le richieste di
 *    questa scheda cambiano insieme al token e con esse la forma dei dati (personali solo con un account);
 *  - rinnovo automatico del JWT finché c'è un utente registrato, fermato all'uscita;
 *  - verifica della sessione all'avvio (verifica).
 *  @returns `nonVerificata` = la verifica all'avvio non ha avuto risposta dal server; `riprova` la ripete */
function useSessione() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const setUser = useAppStore((s) => s.setUser);
  const rehydrate = useAppStore((s) => s.rehydrate);
  const registrato = !!user && !user.guest;
  const inUscita = useRef(false);
  // Utente la cui sessione non si è potuta verificare. Si confronta con quello attuale: dopo un'uscita o un nuovo
  // accesso l'avviso non vale più
  const [nonVerificato, setNonVerificato] = useState<User | null>(null);

  /** Una sola uscita alla volta: il rinnovo respinto e la verifica all'avvio possono segnalare la stessa fine */
  const fineSessione = async () => {
    const u = useAppStore.getState().user;
    if (inUscita.current || !u || u.guest) return;
    inUscita.current = true;
    try {
      const { nonSalvate } = await logout();
      navigate("/", { state: { messaggio: messaggioFineSessione(nonSalvate) } });
    } finally {
      inUscita.current = false;
    }
  };

  /** Verifica la sessione salvata e carica le leghe (un JWT scaduto si rinnova dentro api()). Server che non risponde:
   *  avviso con «Riprova» e la sessione resta. Sessione valida: l'utente del server sostituisce la copia salvata nel
   *  browser (nome e ruolo possono essere cambiati). Sessione finita: form con il messaggio */
  const verifica = async () => {
    setNonVerificato(null);
    const prima = useAppStore.getState().user;
    const r = await authService.me();
    // Nel frattempo l'utente è uscito, qui o in un'altra scheda, oppure è entrato un altro: l'esito riguarda una
    // sessione che non c'è più e non va applicato (rimetterebbe nello store e nel browser chi è appena uscito)
    if (useAppStore.getState().user !== prima) return;
    if (r.esito === "scaduta") { await fineSessione(); return; }
    if (r.esito === "irraggiungibile") { setNonVerificato(useAppStore.getState().user); return; }
    setUser(r.user);
    saveSession(r.user);
    await rehydrate();
  };

  // Effect Event: il gestore registrato una volta sola usa sempre il logout e la navigate più recenti
  const alFineSessione = useEffectEvent(() => { void fineSessione(); });
  useEffect(() => suSessioneFinita(() => alFineSessione()), []);
  useEffect(() => suSessioneCambiataAltrove(() => useAnagrafeStore.getState().svuota()), []);

  useEffect(() => {
    if (!registrato) return;
    return avviaRinnovoAutomatico();
  }, [registrato]);

  // Solo al primo montaggio: login e registrazione caricano le leghe da soli
  const verificaAllAvvio = useEffectEvent(() => {
    if (registrato) void verifica();
  });
  useEffect(() => { verificaAllAvvio(); }, []);

  return { nonVerificata: nonVerificato !== null && nonVerificato === user, riprova: () => { void verifica(); } };
}

/** Avviso all'avvio quando il server non risponde: la sessione resta aperta e «Riprova» ripete la verifica */
function AvvisoServer({ onRiprova }: { onRiprova: () => void }) {
  return (
    <ErroreCaricamento cosa="Server non raggiungibile: non è stato possibile caricare le tue leghe."
      motivo="La sessione resta aperta: riprova quando la connessione torna." onRiprova={onRiprova} />
  );
}

/** Contenuto della pagina. Sta dentro il router perché la fine della sessione riporta al form con navigate.
 *  Le pagine stanno dentro un ErrorBoundary: se una non si riesce a disegnare compare un messaggio con «Ricarica» e il resto
 *  dell'app (intestazione, navigazione) resta; cambiando pagina dal menu il messaggio sparisce. */
function Pagine() {
  const ready = useAppStore((s) => s.ready);
  const { nonVerificata, riprova } = useSessione();
  const { pathname } = useLocation();
  if (nonVerificata) return <AvvisoServer onRiprova={riprova} />;
  if (!ready) return <Loading>Caricamento delle tue leghe…</Loading>;
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leghe" element={<LegheListPage />} />
        <Route path="/lega" element={<LegaPage />} />
        <Route path="/lega/tappa/:id" element={<TappaPage />} />
        <Route path="/tappa/:id" element={<TappaViewPage />} /> {/* pubblica */}
        <Route path="/anagrafe" element={<AnagrafePage />} />
        <Route path="/giocatore/:id" element={<GiocatorePage />} />
        <Route path="/archivio" element={<ArchivioPage />} />
        <Route path="/campetti" element={<CampettiPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  const [coachOpen, setCoachOpen] = useState(false); // stato del pannello Coach AI

  return (
    <BrowserRouter>
      <Header />
      <SyncBanner />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28">
        <Pagine />
      </main>
      {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}
      <CoachFAB onClick={() => setCoachOpen((o) => !o)} />
    </BrowserRouter>
  );
}
