import { useState } from "react";
import { INK, RULE } from "../../constants/colors";
import { Input } from "../ui/Input";
import { REG_ROLES } from "../../constants/roles";
import { eta } from "../../utils/eta";
import { useScrollLock } from "../../hooks/useScrollLock";
import { safeUrl } from "../../utils/safeUrl";
import type { RegGiocatore, RegSquadra, User } from "../../types";

type EditDraft = Omit<RegGiocatore, "id" | "autore" | "ts">;

/** Modale con tutte le informazioni di un giocatore dell'anagrafe.
 *  L'autore può modificare tutti i campi o eliminare il giocatore. */
export function GiocatoreModal({
  g,
  user,
  squadre,
  onClose,
  onRemove,
  onUpdate,
}: {
  g: RegGiocatore;
  user: User;
  squadre?: RegSquadra[];
  onClose: () => void;
  onRemove: () => void;
  onUpdate: (updated: RegGiocatore) => void;
}) {
  useScrollLock();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>({
    nome: g.nome, cognome: g.cognome, soprannome: g.soprannome,
    nascita: g.nascita, citta: g.citta, nazionalita: g.nazionalita,
    altezza: g.altezza, peso: g.peso, ruolo: g.ruolo,
    numero: g.numero, squadra: g.squadra, esperienza: g.esperienza, note: g.note,
  });

  const set = (k: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const saveEdit = () => { onUpdate({ ...g, ...draft }); setEditing(false); };
  const handleRemove = () => { onRemove(); onClose(); };
  const canEdit = !user.guest && g.autore === user.name;
  const age = eta(g.nascita);
  // Cerca il logo della squadra abbinando il nome del giocatore con la lista squadre
  const squadraLogo = squadre?.find((s) => s.nome === g.squadra)?.logo ?? null;

  return (
    <div
      onClick={onClose}
      className="modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda giocatore ${g.nome} ${g.cognome}`}
        className="modal-card"
        style={{ width: "min(480px, 100%)", maxHeight: "88vh", padding: 24 }}
      >
        {/* Pulsante chiudi */}
        <div className="flex jc-end" style={{ marginBottom: 4 }}>
          <button onClick={onClose} className="linkbtn t-ink" style={{ fontSize: 22 }} aria-label="Chiudi">×</button>
        </div>

        {/* Intestazione: logo squadra + nome + numero */}
        <div className="tac" style={{ borderBottom: `3px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
          {squadraLogo && (
            <img src={safeUrl(squadraLogo)} alt="" aria-hidden
              style={{ width: 80, height: 80, objectFit: "contain", display: "block", margin: "0 auto 8px" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="disp up" style={{ fontSize: 28 }}>
            {g.nome} {g.cognome}
            {g.numero && <span className="t-orange"> #{g.numero}</span>}
          </div>
          {g.soprannome && (
            <div className="ui t-orange" style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              "{g.soprannome}"
            </div>
          )}
        </div>

        {/* ── Modalità visualizzazione ── */}
        {!editing && (
          <div className="ui" style={{ fontSize: 13.5, lineHeight: 2, marginBottom: 14 }}>
            <div><strong>{g.ruolo}</strong>{g.squadra ? <> · {g.squadra}</> : null}</div>
            {g.nascita && (
              <div>
                Nato il {g.nascita}{age !== null ? ` (${age} anni)` : ""}
                {g.citta ? ` a ${g.citta}` : ""}
              </div>
            )}
            {!g.nascita && g.citta && <div>Città: {g.citta}</div>}
            {g.nazionalita && <div>Nazionalità: {g.nazionalita}</div>}
            {(g.altezza || g.peso) && (
              <div>
                {g.altezza ? `${g.altezza} cm` : ""}
                {g.altezza && g.peso ? " · " : ""}
                {g.peso ? `${g.peso} kg` : ""}
              </div>
            )}
            {g.esperienza && <div>Esperienza: {g.esperienza} anni</div>}
            {g.note && <p style={{ fontStyle: "italic", margin: "8px 0 0", fontSize: 13.5 }}>{g.note}</p>}
          </div>
        )}

        {/* ── Modalità modifica ── */}
        {editing && (
          <div className="col gap-10" style={{ marginBottom: 14 }}>
            <div className="grid-auto" style={{ "--min": "140px" }}>
              <Input label="Nome" value={draft.nome} onChange={set("nome")} />
              <Input label="Cognome" value={draft.cognome} onChange={set("cognome")} />
              <Input label="Soprannome" value={draft.soprannome} onChange={set("soprannome")} />
              <Input label="Data di nascita" type="date" value={draft.nascita} onChange={set("nascita")} />
              <Input label="Città" value={draft.citta} onChange={set("citta")} />
              <Input label="Nazionalità" value={draft.nazionalita} onChange={set("nazionalita")} />
              <Input label="Altezza (cm)" type="number" min={0} value={draft.altezza} onChange={set("altezza")} />
              <Input label="Peso (kg)" type="number" min={0} value={draft.peso} onChange={set("peso")} />
              <label className="ui" style={{ fontSize: 11, fontWeight: 700 }}>
                Ruolo
                <select className="statin" style={{ marginTop: 4 }} value={draft.ruolo} onChange={set("ruolo")}>
                  {REG_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <Input label="N. maglia" type="number" min={0} value={draft.numero} onChange={set("numero")} />
              <Input label="Squadra" value={draft.squadra} onChange={set("squadra")} />
              <Input label="Anni di esperienza" type="number" min={0} value={draft.esperienza} onChange={set("esperienza")} />
            </div>
            <Input label="Note sportive" value={draft.note} onChange={set("note")} placeholder="es. tiratore da fuori" />
            <div className="flex gap-8" style={{ marginTop: 4 }}>
              <button onClick={saveEdit} className="blackbtn" style={{ padding: "10px 18px" }}>Salva modifiche</button>
              <button onClick={() => setEditing(false)} className="linkbtn t-ink">Annulla</button>
            </div>
          </div>
        )}

        {/* Footer: autore + azioni */}
        <div className="row between wrap gap-8" style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10, marginTop: 4 }}>
          <span className="ui" style={{ fontSize: 10.5, opacity: 0.5 }}>Registrato da {g.autore}</span>
          {canEdit && !editing && (
            <div className="flex gap-12">
              <button onClick={() => setEditing(true)} className="linkbtn t-ink">Modifica</button>
              <button onClick={handleRemove} className="linkbtn t-red">Elimina giocatore</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
