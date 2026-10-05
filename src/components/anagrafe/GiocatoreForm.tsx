/** Form per registrare un nuovo giocatore nell'anagrafe condivisa del circuito. Si svuota solo se il salvataggio riesce:
 *  `onSave` rifiuta la promessa se il server non accetta, e allora il motivo compare sotto i pulsanti e i dati restano. */
import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { REG_ROLES } from "../../constants/roles";
import { Input } from "../ui/Input";
import type { GiocatoreInput } from "../../services/anagrafeApi";
import type { RegSquadra } from "../../types";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type Draft = GiocatoreInput;
const EMPTY: Draft = {
  nome: "", cognome: "", soprannome: "", nascita: "", citta: "", nazionalita: "Italia",
  altezza: "", peso: "", ruolo: "Universale", numero: "", squadra: "", esperienza: "", note: "",
};

export function GiocatoreForm({ squadre, onSave }: { squadre: RegSquadra[]; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const { invio, errore, setErrore, esegui } = useInvio();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  const save = async () => {
    if (!d.nome.trim() || !d.cognome.trim()) { setErrore("Nome e cognome sono obbligatori."); return; }
    // Si svuota solo se il server ha accettato: altrimenti chi scrive ritrova ciò che aveva scritto
    if (await esegui(() => onSave(d), "Salvataggio non riuscito")) setD(EMPTY);
  };

  return (
    <Card className="mb-4">
      <h3 className="font-display text-xl mb-3">Registra un giocatore</h3>
      <div className="grid-auto">
        {/* Nome e cognome: 80 caratteri come GiocatoreRequestDTO, oltre il server risponde 400 */}
        <Input label="Nome *" value={d.nome} onChange={set("nome")} maxLength={80} />
        <Input label="Cognome *" value={d.cognome} onChange={set("cognome")} maxLength={80} />
        <Input label="Soprannome" value={d.soprannome} onChange={set("soprannome")} placeholder="da campo" maxLength={50} />
        <Input label="Data di nascita" type="date" value={d.nascita} onChange={set("nascita")} />
        <Input label="Città" value={d.citta} onChange={set("citta")} />
        <Input label="Nazionalità" value={d.nazionalita} onChange={set("nazionalita")} />
        <Input label="Altezza (cm)" type="number" min={0} value={d.altezza} onChange={set("altezza")} />
        <Input label="Peso (kg)" type="number" min={0} value={d.peso} onChange={set("peso")} />
        <label className="input-label">Ruolo
          <select className="statin mt-1" value={d.ruolo} onChange={set("ruolo")}>
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
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      <Button className="mt-3" onClick={save} disabled={invio}>Salva nell'anagrafe</Button>
    </Card>
  );
}
