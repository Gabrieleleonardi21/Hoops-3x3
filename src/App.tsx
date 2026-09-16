/** Radice dell'applicazione: configura il router e inserisce Coach AI (FAB + pannello)
 *  fuori dal flusso di pagine così resta visibile su tutte le rotte. */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Header } from "./components/layout/Header";
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

export default function App() {
  const [coachOpen, setCoachOpen] = useState(false); // stato del pannello Coach AI

  return (
    <BrowserRouter>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28">
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
      </main>
      {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}
      <CoachFAB onClick={() => setCoachOpen((o) => !o)} />
    </BrowserRouter>
  );
}
