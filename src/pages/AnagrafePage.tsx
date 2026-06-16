/** Pagina dell'anagrafe condivisa del circuito: due tab (giocatori / squadre) con
 *  ricerca testuale, form di registrazione e modale di dettaglio squadra. */
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { GiocatoreForm } from "../components/anagrafe/GiocatoreForm";
import { GiocatoreCard } from "../components/anagrafe/GiocatoreCard";
import { SquadraAnagrafeForm } from "../components/anagrafe/SquadraAnagrafeForm";
import { SquadraAnagrafeCard } from "../components/anagrafe/SquadraAnagrafeCard";
import { SquadraAnagrafeModal } from "../components/anagrafe/SquadraAnagrafeModal";
import { Loading } from "../components/ui/Loading";
import { RED } from "../constants/colors";
import type { RegSquadra } from "../types";

export function AnagrafePage() {
  const user = useAppStore((s) => s.user);
  const [tab, setTab] = useState<"g" | "s">("g");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selSquadra, setSelSquadra] = useState<RegSquadra | null>(null);
  const anagrafe = useAnagrafe(user ?? { name: "Ospite", guest: true });
  if (!user) return <Navigate to="/" replace />;
  const { giocatori, squadre, saveGiocatore, saveSquadra, removeGiocatore, removeSquadra } = anagrafe;

  // Filtra un array su più campi testuali con la query di ricerca
  const filtered = <T,>(arr: T[] | null, fields: (keyof T)[]): T[] => {
    const q = query.trim().toLowerCase();
    if (!q) return arr || [];
    return (arr || []).filter((r) => fields.some((f) => String(r[f] || "").toLowerCase().includes(q)));
  };
  const gList = filtered(giocatori, ["nome", "cognome", "soprannome", "citta", "squadra", "ruolo"]);
  const sList = filtered(squadre, ["nome", "citta", "referente"]);

  // Blocca le scritture per gli ospiti: possono solo consultare l'anagrafe
  const guard = async (fn: () => Promise<void>) => {
    if (user.guest) { setMsg("La registrazione nell'anagrafe richiede un account: l'Ospite può solo consultare."); return; }
    setMsg(null);
    try { await fn(); setShowForm(false); } catch { setMsg("Salvataggio non riuscito, riprova."); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {([["g", `Giocatori (${(giocatori || []).length})`], ["s", `Squadre (${(squadre || []).length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setShowForm(false); setMsg(null); }}
            className={`navbtn${tab === id ? " active" : ""}`} style={{ fontFamily: "'Archivo', sans-serif", textTransform: "none", fontSize: 13.5 }}>
            {label}
          </button>
        ))}
        <input className="statin" style={{ flex: "1 1 180px", maxWidth: 280 }} value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome, città, squadra…" />
        <button onClick={() => { setShowForm(!showForm); setMsg(null); }} className="redbtn" style={{ padding: "10px 16px" }}>
          {showForm ? "Chiudi" : tab === "g" ? "+ Registra giocatore" : "+ Registra squadra"}
        </button>
      </div>

      <p className="ui" style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.8, margin: "0 0 14px" }}>
        L'anagrafe è condivisa: i dati registrati sono visibili a tutti gli utenti del circuito. Inserisci solo
        informazioni che possono essere rese pubbliche e per cui hai il consenso degli interessati.
      </p>

      {msg && <p className="ui" style={{ color: RED, fontWeight: 700, fontSize: 13, margin: "0 0 10px" }}>{msg}</p>}

      {showForm && tab === "g" && <GiocatoreForm squadre={squadre || []} onSave={(d) => guard(() => saveGiocatore(d))} />}
      {showForm && tab === "s" && <SquadraAnagrafeForm giocatori={giocatori || []} onSave={(d) => guard(() => saveSquadra(d))} />}

      {tab === "g" && (
        giocatori === null ? <Loading>Sto aprendo l'anagrafe…</Loading> :
        gList.length === 0 ? (
          <p style={{ fontStyle: "italic", fontSize: 15 }}>
            {query ? "Nessun giocatore trovato con questa ricerca." : "Nessun giocatore registrato: aggiungi il primo."}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {gList.map((g) => (
              <GiocatoreCard key={g.id} g={g} user={user} onRemove={() => removeGiocatore(g.id)} />
            ))}
          </div>
        )
      )}

      {tab === "s" && (
        squadre === null ? <Loading>Sto aprendo l'anagrafe…</Loading> :
        sList.length === 0 ? (
          <p style={{ fontStyle: "italic", fontSize: 15 }}>
            {query ? "Nessuna squadra trovata con questa ricerca." : "Nessuna squadra registrata: aggiungi la prima."}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {sList.map((s) => (
              <SquadraAnagrafeCard key={s.id} s={s} giocatori={giocatori || []} user={user}
                onOpen={() => setSelSquadra(s)}
                onRemove={() => removeSquadra(s.id)} />
            ))}
          </div>
        )
      )}
      {selSquadra && (
        <SquadraAnagrafeModal
          s={selSquadra}
          giocatori={giocatori || []}
          user={user}
          onClose={() => setSelSquadra(null)}
          onRemove={() => { removeSquadra(selSquadra.id); setSelSquadra(null); }}
        />
      )}
    </div>
  );
}
