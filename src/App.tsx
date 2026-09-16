/** Radice dell'applicazione: configura il router e inserisce Coach AI (FAB + pannello)
 *  fuori dal flusso di pagine così resta visibile su tutte le rotte. */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAppStore } from "./stores/useAppStore";
import { useAuth } from "./hooks/useAuth";
import * as authService from "./services/authService";
import { Header } from "./components/layout/Header";
import { SyncBanner } from "./components/layout/SyncBanner";
import { Loading } from "./components/ui/Loading";
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

/** All'avvio, per un utente registrato: verifica il token e carica le leghe dal server.
 *  Token scaduto o utente cancellato → logout silenzioso (torna alla home con il form). */
function useBootstrap() {
  const user = useAppStore((s) => s.user);
  const rehydrate = useAppStore((s) => s.rehydrate);
  const { logout } = useAuth();
  useEffect(() => {
    if (!user || user.guest) return;
    authService.me().then((u) => {
      if (!u) { logout(); return; }
      rehydrate();
    });
    // solo al primo mount: login/registrazione chiamano rehydrate da soli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function App() {
  const [coachOpen, setCoachOpen] = useState(false); // stato del pannello Coach AI
  const ready = useAppStore((s) => s.ready);
  useBootstrap();

  return (
    <BrowserRouter>
      <Header />
      <SyncBanner />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28">
        {!ready && <Loading>Caricamento delle tue leghe…</Loading>}
        {ready && <Routes>
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
        </Routes>}
      </main>
      {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}
      <CoachFAB onClick={() => setCoachOpen((o) => !o)} />
    </BrowserRouter>
  );
}
