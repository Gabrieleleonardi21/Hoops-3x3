/** Form per registrare un nuovo giocatore nell'anagrafe condivisa del circuito. */
import { useState } from "react";
import { INK, RED } from "../../constants/colors";
import { REG_ROLES } from "../../constants/roles";
import { Input } from "../ui/Input";
import type { RegGiocatore, RegSquadra } from "../../types";

type Draft = Omit<RegGiocatore, "id" | "autore" | "ts">;
const EMPTY: Draft = {
  nome: "", cognome: "", soprannome: "", nascita: "", citta: "", nazionalita: "Italia",
  altezza: "", peso: "", ruolo: "Universale", numero: "", squadra: "", esperienza: "", note: "",
};

export function GiocatoreForm({ squadre, onSave }: { squadre: RegSquadra[]; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  const save = async () => {
    if (!d.nome.trim() || !d.cognome.trim()) { setErr("Nome e cognome sono obbligatori."); return; }
    setErr(null);
    await onSave(d);
    setD(EMPTY);
  };

  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 16, marginBottom: 18 }}>
      <h3 className="disp" style={{ fontSize: 16, margin: "0 0 10px", textTransform: "uppercase" }}>Registra un giocatore</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Input label="Nome *" value={d.nome} onChange={set("nome")} maxLength={100} />
        <Input label="Cognome *" value={d.cognome} onChange={set("cognome")} maxLength={100} />
        <Input label="Soprannome" value={d.soprannome} onChange={set("soprannome")} placeholder="da campo" maxLength={50} />
        <Input label="Data di nascita" type="date" value={d.nascita} onChange={set("nascita")} />
        <Input label="Città" value={d.citta} onChange={set("citta")} />
        <Input label="Nazionalità" value={d.nazionalita} onChange={set("nazionalita")} />
        <Input label="Altezza (cm)" type="number" min={0} value={d.altezza} onChange={set("altezza")} />
        <Input label="Peso (kg)" type="number" min={0} value={d.peso} onChange={set("peso")} />
        <label className="ui" style={{ fontSize: 11, fontWeight: 700 }}>Ruolo
          <select className="statin" style={{ marginTop: 4 }} value={d.ruolo} onChange={set("ruolo")}>
            {REG_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <Input label="N. maglia" type="number" min={0} value={d.numero} onChange={set("numero")} />
        <Input label="Squadra" value={d.squadra} onChange={set("squadra")} list="reg-squadre" />
        <Input label="Anni di esperienza" type="number" min={0} value={d.esperienza} onChange={set("esperienza")} />
      </div>
      <datalist id="reg-squadre">
        {squadre.map((s) => <option key={s.id} value={s.nome} />)}
      </datalist>
      <Input label="Note sportive" labelStyle={{ marginTop: 10 }} value={d.note} onChange={set("note")}
        placeholder="es. tiratore da fuori, ex serie C" maxLength={500} />
      {err && <p className="ui" style={{ color: RED, fontWeight: 700, fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
      <button onClick={save} className="blackbtn" style={{ marginTop: 12 }}>Salva nell'anagrafe</button>
    </div>
  );
}
