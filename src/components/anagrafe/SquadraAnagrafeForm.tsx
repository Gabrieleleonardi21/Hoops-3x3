/** Form per registrare una nuova squadra nell'anagrafe condivisa. Si svuota solo se il salvataggio riesce: `onSave` rifiuta la
 *  promessa se il server non accetta, e allora il motivo compare sotto i pulsanti e i dati restano. */
import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import type { SquadraInput } from "../../services/anagrafeApi";
import type { RegGiocatore } from "../../types";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type Draft = SquadraInput;
const EMPTY: Draft = { nome: "", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "" };

export function SquadraAnagrafeForm({ giocatori, onSave }: { giocatori: RegGiocatore[]; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [pick, setPick] = useState("");
  const { invio, errore, setErrore, esegui } = useInvio();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });
  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };

  const addToRoster = () => {
    if (!pick || d.roster.includes(pick)) return;
    setD({ ...d, roster: [...d.roster, pick] });
    setPick("");
  };

  const save = async () => {
    if (!d.nome.trim()) { setErrore("Il nome della squadra è obbligatorio."); return; }
    // Si svuota solo se il server ha accettato: altrimenti chi scrive ritrova ciò che aveva scritto
    if (await esegui(() => onSave(d), "Salvataggio non riuscito")) setD(EMPTY);
  };

  return (
    <Card className="mb-4">
      <h3 className="font-display text-xl mb-3">Registra una squadra</h3>
      <div className="grid-auto">
        <Input label="Nome squadra *" value={d.nome} onChange={set("nome")} maxLength={100} />
        <Input label="Città" value={d.citta} onChange={set("citta")} maxLength={100} />
        <Input label="Anno di fondazione" type="number" value={d.anno} onChange={set("anno")} />
        <Input label="Ranking circuito (punti)" type="number" min={0} value={d.rank} onChange={set("rank")} />
        <Input label="Referente / capitano" value={d.referente} onChange={set("referente")} maxLength={100} />
        <Input label="Logo (URL o /logos/nome.svg)" value={d.logo} onChange={set("logo")} placeholder="/logos/squadra.svg" maxLength={500} />
        <Input label="Sito web (opzionale)" value={d.website} onChange={set("website")} placeholder="https://squadra.it" maxLength={500} />
        <Input label="Instagram (opzionale)" value={d.instagram} onChange={set("instagram")} placeholder="https://instagram.com/squadra" maxLength={500} />
      </div>
      <div className="input-label mt-3">Roster (dai giocatori registrati, max 6)</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <select className="statin max-w-[260px]" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Scegli un giocatore">
          <option value="">— scegli un giocatore —</option>
          {giocatori.filter((g) => !d.roster.includes(g.id)).map((g) => (
            <option key={g.id} value={g.id}>{g.nome} {g.cognome}{g.squadra ? ` (${g.squadra})` : ""}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={addToRoster}>Aggiungi</Button>
        {d.roster.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-sm border border-asphalt-600 bg-asphalt-800 px-2 py-1 text-xs font-semibold text-chalk">
            {gName(id)}
            <button onClick={() => setD({ ...d, roster: d.roster.filter((x) => x !== id) })} className="text-chalk-dim hover:text-loss" aria-label={`Rimuovi ${gName(id)}`}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <Input label="Note" labelStyle={{ marginTop: 10 }} value={d.note} onChange={set("note")}
        placeholder="es. campioni tappa di Roma 2025" maxLength={500} />
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      <Button className="mt-3" onClick={save} disabled={invio}>Salva nell'anagrafe</Button>
    </Card>
  );
}
