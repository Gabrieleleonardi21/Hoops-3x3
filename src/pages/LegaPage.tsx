import { Navigate, useNavigate } from "react-router-dom";
import { useLega } from "../hooks/useLega";
import { TappaForm } from "../components/tappa/TappaForm";
import { TappaCard } from "../components/tappa/TappaCard";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { INK } from "../constants/colors";

export function LegaPage() {
  const { user, legaName, tappe, setLegaName, createTappa } = useLega();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/" replace />;

  return (
    <>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser, non sincronizzati tra dispositivi. I controlli obbligatori su roster e punti sono disattivati. Registrati per la gestione completa." />

      <div style={{ maxWidth: 420, marginBottom: 22 }}>
        <Input label="La tua lega — circuito italiano 3x3"
          labelStyle={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}
          value={legaName} onChange={(e) => setLegaName(e.target.value)}
          placeholder="Es. Roma Streetball League" />
      </div>

      <TappaForm onCreate={(input) => { const t = createTappa(input); navigate(`/lega/tappa/${t.id}`); }} />

      {tappe.length > 0 ? (
        <section style={{ borderTop: `4px solid ${INK}` }}>
          <div className="ui" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 2px", fontWeight: 700 }}>
            Le tappe del circuito
          </div>
          {tappe.map((t) => (
            <TappaCard key={t.id} t={t} onOpen={() => navigate(`/lega/tappa/${t.id}`)} />
          ))}
        </section>
      ) : (
        <p style={{ fontStyle: "italic", fontSize: 15 }}>Nessuna tappa in calendario: crea la prima qui sopra.</p>
      )}
    </>
  );
}
