/** Pannello di modifica in-page: permette di cambiare nome, luogo, data, numero gironi
 *  e aggiungere squadre. Aggiungere squadre o cambiare i gironi azzera il sorteggio. */
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import type { useTappa } from "../../hooks/useTappa";

export function TappaEditPanel({ h }: { h: ReturnType<typeof useTappa> }) {
  const t = h.tappa!;
  return (
    <Card className="mt-3">
      <h3 className="font-display text-lg mb-2.5">Modifica tappa</h3>
      <div className="grid-auto" style={{ "--min": "160px" }}>
        <Input label="Nome" value={t.nome} onChange={(e) => h.setInfo("nome", e.target.value)} />
        <Input label="Luogo" value={t.luogo} onChange={(e) => h.setInfo("luogo", e.target.value)} />
        <Input label="Data" type="date" value={t.data} onChange={(e) => h.setInfo("data", e.target.value)} />
        <Input label="Numero gironi" type="number" min={1} value={t.nGironi} onChange={(e) => h.setNGironi(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" onClick={h.addTeam}><Icon name="plus" size={14} /> Aggiungi squadra</Button>
        <span className="text-xs font-semibold text-court">
          Aggiungere/rimuovere squadre o cambiare il numero di gironi azzera sorteggio e risultati.
        </span>
      </div>
    </Card>
  );
}
