/** Pannello di modifica in-page: permette di cambiare nome, luogo, data, numero gironi
 *  e aggiungere squadre. Aggiungere squadre o cambiare i gironi azzera il sorteggio. */
import { INK, RED } from "../../constants/colors";
import { Input } from "../ui/Input";
import type { useTappa } from "../../hooks/useTappa";

export function TappaEditPanel({ h }: { h: ReturnType<typeof useTappa> }) {
  const t = h.tappa!;
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 14, marginTop: 12 }}>
      <h3 className="disp up" style={{ fontSize: 15, margin: "0 0 10px" }}>Modifica tappa</h3>
      <div className="grid-auto" style={{ "--min": "160px" }}>
        <Input label="Nome" value={t.nome} onChange={(e) => h.setInfo("nome", e.target.value)} />
        <Input label="Luogo" value={t.luogo} onChange={(e) => h.setInfo("luogo", e.target.value)} />
        <Input label="Data" type="date" value={t.data} onChange={(e) => h.setInfo("data", e.target.value)} />
        <Input label="Numero gironi" type="number" min={1} value={t.nGironi} onChange={(e) => h.setNGironi(e.target.value)} />
      </div>
      <div className="row gap-10 wrap" style={{ marginTop: 10 }}>
        <button onClick={h.addTeam} className="blackbtn" style={{ padding: "9px 14px", fontSize: 12.5 }}>+ Aggiungi squadra</button>
        <span className="ui t-red" style={{ fontSize: 11.5, fontWeight: 700 }}>
          Aggiungere/rimuovere squadre o cambiare il numero di gironi azzera sorteggio e risultati.
        </span>
      </div>
    </div>
  );
}
