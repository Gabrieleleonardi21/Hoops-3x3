/** Pagina principale della lega attiva: gestisce nome, creazione, lista tappe e classifica circuito. */
import { useMemo } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useLega } from "../hooks/useLega";
import { TappaForm } from "../components/tappa/TappaForm";
import { TappaCard } from "../components/tappa/TappaCard";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { INK, ORANGE, RULE } from "../constants/colors";
import { useAppStore } from "../stores/useAppStore";

export function LegaPage() {
  const { user, legaName, tappe, setLegaName, createTappa } = useLega();
  const legaId = useAppStore((s) => s.legaId);
  const navigate = useNavigate();

  // Classifica circuito: aggrega tutte le squadre da tutte le tappe,
  // prende il rank massimo per squadra (nome case-insensitive) e ordina in modo decrescente
  // Deve stare prima degli early return per rispettare le rules-of-hooks
  const circuitRanking = useMemo(() => {
    const map = new Map<string, { nome: string; rank: number; nTappe: number }>();
    for (const tappa of tappe) {
      for (const s of tappa.squadre) {
        const key = s.nome.trim().toLowerCase();
        const r = Number(s.rank) || 0;
        const cur = map.get(key);
        if (cur) {
          cur.rank = Math.max(cur.rank, r);
          cur.nTappe += 1;
        } else {
          map.set(key, { nome: s.nome.trim(), rank: r, nTappe: 1 });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.rank - a.rank);
  }, [tappe]);

  if (!user) return <Navigate to="/" replace />;
  // Se nessuna lega è attiva, manda alla lista per selezionarne una
  if (!legaId) return <Navigate to="/leghe" replace />;

  return (
    <>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser, non sincronizzati tra dispositivi. I controlli obbligatori su roster e punti sono disattivati. Registrati per la gestione completa." />

      {/* Breadcrumb di navigazione verso la lista leghe */}
      <div style={{ marginBottom: 14 }}>
        <Link to="/leghe" className="linkbtn" style={{ fontSize: 12.5, color: INK, opacity: 0.6 }}>
          ← Le mie leghe
        </Link>
      </div>

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

      {/* Classifica circuito — visibile solo se ci sono squadre con rank */}
      {circuitRanking.length > 0 && (
        <section style={{ borderTop: `4px solid ${INK}`, marginTop: 24 }}>
          <div className="ui" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 8px", fontWeight: 700 }}>
            Classifica circuito
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <th className="ui" style={{ textAlign: "left", fontSize: 11, fontWeight: 700, padding: "4px 8px", width: 32 }}>#</th>
                <th className="ui" style={{ textAlign: "left", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Squadra</th>
                <th className="ui" style={{ textAlign: "right", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Punti</th>
                <th className="ui" style={{ textAlign: "right", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Tappe</th>
              </tr>
            </thead>
            <tbody>
              {circuitRanking.map((row, i) => (
                <tr key={row.nome} style={{ borderBottom: `1px solid ${RULE}`, background: i === 0 ? "var(--card)" : "transparent" }}>
                  <td className="disp" style={{ fontSize: 13, padding: "6px 8px", color: i < 3 ? ORANGE : INK, fontWeight: 700 }}>
                    {i + 1}
                  </td>
                  <td className="disp" style={{ fontSize: 14, padding: "6px 8px", textTransform: "uppercase" }}>{row.nome}</td>
                  <td className="ui" style={{ fontSize: 13, fontWeight: 700, padding: "6px 8px", textAlign: "right", color: ORANGE }}>
                    {row.rank > 0 ? row.rank : "—"}
                  </td>
                  <td className="ui" style={{ fontSize: 12, padding: "6px 8px", textAlign: "right", opacity: 0.6 }}>{row.nTappe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
