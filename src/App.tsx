/** Radice dell'applicazione: configura il router e inserisce Coach AI (FAB + pannello)
 *  fuori dal flusso di pagine così resta visibile su tutte le rotte. */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Header } from "./components/layout/Header";
import { NavBar } from "./components/layout/NavBar";
import { CoachFAB } from "./components/coach/CoachFAB";
import { CoachPanel } from "./components/coach/CoachPanel";
import { useAppStore } from "./stores/useAppStore";
import { HomePage } from "./pages/HomePage";
import { LegaPage } from "./pages/LegaPage";
import { TappaPage } from "./pages/TappaPage";
import { TappaViewPage } from "./pages/TappaViewPage";
import { AnagrafePage } from "./pages/AnagrafePage";
import { ArchivioPage } from "./pages/ArchivioPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  const user = useAppStore((s) => s.user);
  const [coachOpen, setCoachOpen] = useState(false); // stato del pannello Coach AI

  return (
    <BrowserRouter>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 18px 100px" }}>
        <Header />
        {user && <NavBar />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lega" element={<LegaPage />} />
          <Route path="/lega/tappa/:id" element={<TappaPage />} />
          <Route path="/tappa/:id" element={<TappaViewPage />} /> {/* pubblica */}
          <Route path="/anagrafe" element={<AnagrafePage />} />
          <Route path="/archivio" element={<ArchivioPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}
      <CoachFAB onClick={() => setCoachOpen((o) => !o)} />
    </BrowserRouter>
  );
}
