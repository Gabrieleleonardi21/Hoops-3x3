import { useState } from "react";
import { INK, PAPER } from "../../constants/colors";
import { Input } from "../ui/Input";
import type { RegGiocatore, RegSquadra } from "../../types";

type Draft = Omit<RegSquadra, "id" | "autore" | "ts">;
const EMPTY: Draft = { nome: "", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "" };

export function SquadraAnagrafeForm({ giocatori, onSave }: { giocatori: RegGiocatore[]; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);
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
    if (!d.nome.trim()) { setErr("Il nome della squadra è obbligatorio."); return; }
    setErr(null);
    await onSave(d);
    setD(EMPTY);
  };

  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 16, marginBottom: 18 }}>
      <h3 className="disp up" style={{ fontSize: 16, margin: "0 0 10px" }}>Registra una squadra</h3>
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
      <div className="ui" style={{ fontSize: 11, fontWeight: 700, marginTop: 10 }}>Roster (dai giocatori registrati, max 6)</div>
      <div className="row wrap gap-6" style={{ marginTop: 4 }}>
        <select className="statin" style={{ maxWidth: 260 }} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">— scegli un giocatore —</option>
          {giocatori.filter((g) => !d.roster.includes(g.id)).map((g) => (
            <option key={g.id} value={g.id}>{g.nome} {g.cognome}{g.squadra ? ` (${g.squadra})` : ""}</option>
          ))}
        </select>
        <button onClick={addToRoster} className="blackbtn" style={{ padding: "8px 12px", fontSize: 12 }}>Aggiungi</button>
        {d.roster.map((id) => (
          <span key={id} className="ui" style={{ background: PAPER, border: `1px solid ${INK}`, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>
            {gName(id)}{" "}
            <button onClick={() => setD({ ...d, roster: d.roster.filter((x) => x !== id) })}
              className="linkbtn t-ink" style={{ opacity: 0.5 }}>×</button>
          </span>
        ))}
      </div>
      <Input label="Note" labelStyle={{ marginTop: 10 }} value={d.note} onChange={set("note")}
        placeholder="es. campioni tappa di Roma 2025" maxLength={500} />
      {err && <p className="ui t-red" style={{ fontWeight: 700, fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
      <button onClick={save} className="blackbtn" style={{ marginTop: 12 }}>Salva nell'anagrafe</button>
    </div>
  );
}
