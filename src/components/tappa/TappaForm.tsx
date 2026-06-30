/** Form per creare una nuova tappa: raccoglie nome, luogo, data, numero squadre e gironi. */
import { useState } from "react";
import { INK } from "../../constants/colors";
import { Input } from "../ui/Input";
import type { NuovaTappaInput } from "../../hooks/useLega";

export function TappaForm({ onCreate }: { onCreate: (input: NuovaTappaInput) => void }) {
  const [draft, setDraft] = useState<NuovaTappaInput>({ nome: "", luogo: "", data: "", nTeams: 8, nGironi: 2 });
  const set = (k: keyof NuovaTappaInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: e.target.value });

  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 18, marginBottom: 22 }}>
      <h2 className="disp up" style={{ fontSize: 18, margin: "0 0 12px" }}>Crea una Tappa</h2>
      <div className="grid-auto" style={{ "--min": "170px" }}>
        <Input label="Nome tappa" value={draft.nome} onChange={set("nome")} placeholder="Es. Tappa di Roma" />
        <Input label="Luogo" value={draft.luogo} onChange={set("luogo")} placeholder="Es. Piazza del Popolo" />
        <Input label="Data" type="date" value={draft.data} onChange={set("data")} />
        <Input label="Numero squadre" type="number" min={2} max={64} value={draft.nTeams} onChange={set("nTeams")} />
        <Input label="Numero gironi" type="number" min={1} value={draft.nGironi} onChange={set("nGironi")} />
      </div>
      <button onClick={() => { onCreate(draft); setDraft({ nome: "", luogo: "", data: "", nTeams: 8, nGironi: 2 }); }}
        className="redbtn" style={{ marginTop: 14 }}>
        Crea la tappa
      </button>
    </div>
  );
}
