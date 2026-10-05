/** Pagina dell'anagrafe condivisa del circuito: due tab (giocatori / squadre) con
 *  ricerca testuale, form di registrazione e modale di dettaglio squadra. */
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { StatsCircuito } from "../components/anagrafe/StatsCircuito";
import { GiocatoreForm } from "../components/anagrafe/GiocatoreForm";
import { GiocatoreCard } from "../components/anagrafe/GiocatoreCard";
import { SquadraAnagrafeForm } from "../components/anagrafe/SquadraAnagrafeForm";
import { SquadraAnagrafeCard } from "../components/anagrafe/SquadraAnagrafeCard";
import { SquadraAnagrafeModal } from "../components/anagrafe/SquadraAnagrafeModal";
import { GiocatoreModal } from "../components/anagrafe/GiocatoreModal";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { Loading } from "../components/ui/Loading";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import type { RegGiocatore, RegSquadra } from "../types";

export function AnagrafePage() {
  const user  = useAppStore((s) => s.user);
  const tappe = useAppStore((s) => s.tappe);
  const [tab, setTab] = useState<"g" | "s" | "stats">("g");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selSquadra, setSelSquadra] = useState<RegSquadra | null>(null);
  const [selGiocatore, setSelGiocatore] = useState<RegGiocatore | null>(null);
  const anagrafe = useAnagrafe();
  if (!user) return <Navigate to="/" replace />;
  const { giocatori, squadre, errore, load, saveGiocatore, saveSquadra, removeGiocatore, removeSquadra, updateSquadra, updateGiocatore } = anagrafe;

  // Filtra un array su più campi testuali con la query di ricerca
  const filtered = <T,>(arr: T[] | null, fields: (keyof T)[]): T[] => {
    const q = query.trim().toLowerCase();
    if (!q) return arr || [];
    return (arr || []).filter((r) => fields.some((f) => String(r[f] || "").toLowerCase().includes(q)));
  };
  const gList = filtered(giocatori, ["nome", "cognome", "soprannome", "citta", "squadra", "ruolo"]);
  const sList = filtered(squadre, ["nome", "citta", "referente"]);

  // Blocca le scritture per gli ospiti: possono solo consultare l'anagrafe
  const guard = async (fn: () => Promise<unknown>) => {
    if (user.guest) { setMsg("La registrazione nell'anagrafe richiede un account: l'Ospite può solo consultare."); return; }
    setMsg(null);
    try { await fn(); setShowForm(false); } catch { setMsg("Salvataggio non riuscito, riprova."); }
  };

  /** « (3)» accanto al nome della scheda; niente finché l'elenco non è arrivato: «(0)» direbbe che è vuoto */
  const conteggio = (voci: unknown[] | null) => {
    if (voci === null) return "";
    return ` (${voci.length})`;
  };
  const tabs = [["g", `Giocatori${conteggio(giocatori)}`], ["s", `Squadre${conteggio(squadre)}`], ["stats", "Statistiche stagione"]] as const;

  /** Contenuto di una scheda: il caricamento, l'errore con «Riprova», l'elenco vuoto o le card. Un caricamento non riuscito
   *  non si mostra come elenco vuoto: direbbe che nessuno è registrato, mentre non si sa. */
  const contenuto = <T extends { id: string }>(
    voci: T[] | null, filtrate: T[], testi: { vuoto: string; nessuno: string }, card: (voce: T) => React.ReactNode,
  ) => {
    if (voci === null && errore) {
      return <ErroreCaricamento cosa="Non è stato possibile caricare l'anagrafe." motivo={errore} onRiprova={() => { void load(); }} />;
    }
    if (voci === null) return <Loading>Sto aprendo l'anagrafe…</Loading>;
    if (filtrate.length === 0) {
      let testo = testi.vuoto;
      if (query) testo = testi.nessuno;
      return <p className="text-[15px] text-chalk-muted">{testo}</p>;
    }
    return <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">{filtrate.map(card)}</div>;
  };

  return (
    <div>
      <h1 className="font-display text-4xl mb-3">Anagrafe <span className="text-court">circuito</span></h1>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 border-b border-asphalt-700" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setShowForm(false); setMsg(null); }}
              className={`-mb-px border-b-2 px-3 py-2 font-display text-[15px] transition-colors ${tab === id ? "border-court text-chalk" : "border-transparent text-chalk-muted hover:text-chalk"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== "stats" && (
          <>
            <label className="relative ml-auto flex-1 min-w-[180px] max-w-xs">
              <span className="sr-only">Cerca</span>
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chalk-dim" />
              <input className="statin pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome, città, squadra…" />
            </label>
            <Button onClick={() => { setShowForm(!showForm); setMsg(null); }}>
              {showForm ? "Chiudi" : <><Icon name="plus" size={16} /> {tab === "g" ? "Registra giocatore" : "Registra squadra"}</>}
            </Button>
          </>
        )}
      </div>

      <p className="mb-4 text-xs text-chalk-muted">
        L'anagrafe è condivisa: i dati registrati sono visibili a tutti gli utenti del circuito. Inserisci solo
        informazioni che possono essere rese pubbliche e per cui hai il consenso degli interessati.
      </p>

      {msg && <p className="mb-2.5 text-[13px] font-semibold text-loss" role="alert">{msg}</p>}

      {showForm && tab === "g" && <GiocatoreForm squadre={squadre || []} onSave={(d) => guard(() => saveGiocatore(d))} />}
      {showForm && tab === "s" && <SquadraAnagrafeForm giocatori={giocatori || []} onSave={(d) => guard(() => saveSquadra(d))} />}

      {tab === "g" && contenuto(giocatori, gList,
        { vuoto: "Nessun giocatore registrato: aggiungi il primo.", nessuno: "Nessun giocatore trovato con questa ricerca." },
        (g) => (
          <GiocatoreCard key={g.id} g={g} user={user} squadre={squadre || []}
            onOpen={() => setSelGiocatore(g)}
            onRemove={() => removeGiocatore(g.id)} />
        ))}

      {tab === "s" && contenuto(squadre, sList,
        { vuoto: "Nessuna squadra registrata: aggiungi la prima.", nessuno: "Nessuna squadra trovata con questa ricerca." },
        (s) => (
          <SquadraAnagrafeCard key={s.id} s={s} giocatori={giocatori || []} user={user}
            onOpen={() => setSelSquadra(s)}
            onRemove={() => removeSquadra(s.id)} />
        ))}
      {tab === "stats" && (
        <>
          <p className="mb-1 text-xs text-chalk-muted">
            Totali e medie per partita su tutte le tappe della lega corrente. Ordinate per media punti.
          </p>
          <StatsCircuito tappe={tappe} />
        </>
      )}

      {selGiocatore && (
        <GiocatoreModal
          g={selGiocatore}
          user={user}
          squadre={squadre || []}
          onClose={() => setSelGiocatore(null)}
          onRemove={() => { removeGiocatore(selGiocatore.id); setSelGiocatore(null); }}
          onUpdate={(updated) => { updateGiocatore(updated); setSelGiocatore(updated); }}
        />
      )}
      {selSquadra && (
        <SquadraAnagrafeModal
          s={selSquadra}
          giocatori={giocatori || []}
          user={user}
          onClose={() => setSelSquadra(null)}
          onRemove={() => { removeSquadra(selSquadra.id); setSelSquadra(null); }}
          onUpdate={(updated) => { updateSquadra(updated); setSelSquadra(updated); }}
        />
      )}
    </div>
  );
}
