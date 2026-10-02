/** Form per creare una nuova tappa: raccoglie nome, luogo, data, numero squadre e gironi. */
import { useState } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { NuovaTappaInput } from "../../hooks/useLega";

const EMPTY: NuovaTappaInput = { nome: "", luogo: "", data: "", nTeams: 8, nGironi: 2 };

export function TappaForm({ onCreate }: { onCreate: (input: NuovaTappaInput) => void }) {
  const [draft, setDraft] = useState<NuovaTappaInput>(EMPTY);
  const set = (k: keyof NuovaTappaInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: e.target.value });

  return (
    <Card accent className="mb-6">
      <h2 className="font-display text-xl mb-3">Crea una tappa</h2>
      <div className="grid-auto" style={{ "--min": "170px" }}>
        <Input label="Nome tappa" value={draft.nome} onChange={set("nome")} placeholder="Es. Tappa di Roma" />
        <Input label="Luogo" value={draft.luogo} onChange={set("luogo")} placeholder="Es. Piazza del Popolo" />
        <Input label="Data" type="date" value={draft.data} onChange={set("data")} />
        <Input label="Numero squadre" type="number" min={2} max={64} value={draft.nTeams} onChange={set("nTeams")} />
        <Input label="Numero gironi" type="number" min={1} value={draft.nGironi} onChange={set("nGironi")} />
      </div>
      <Button className="mt-4" onClick={() => { onCreate(draft); setDraft(EMPTY); }}>Crea la tappa</Button>
    </Card>
  );
}
