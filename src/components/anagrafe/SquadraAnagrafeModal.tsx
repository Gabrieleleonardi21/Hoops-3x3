import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import type { RegGiocatore, RegSquadra, User } from "../../types";
import { safeUrl } from "../../utils/safeUrl";

/** Campi modificabili (roster escluso: richiede UI dedicata) */
type EditDraft = Pick<RegSquadra, "nome" | "citta" | "anno" | "rank" | "referente" | "logo" | "website" | "instagram" | "note">;

/** Modale con tutte le informazioni di una squadra dell'anagrafe.
 *  L'autore può modificare tutti i campi principali o eliminare la squadra. */
export function SquadraAnagrafeModal({
  s,
  giocatori,
  user,
  onClose,
  onRemove,
  onUpdate,
}: {
  s: RegSquadra;
  giocatori: RegGiocatore[];
  user: User;
  onClose: () => void;
  onRemove: () => void;
  onUpdate: (updated: RegSquadra) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>({
    nome: s.nome, citta: s.citta, anno: s.anno, rank: s.rank,
    referente: s.referente, logo: s.logo,
    website: s.website, instagram: s.instagram || "", note: s.note,
  });

  const set = (k: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const saveEdit = () => {
    onUpdate({ ...s, ...draft });
    setEditing(false);
  };

  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };

  const canEdit = !user.guest && s.autore === user.name;

  const handleRemove = () => { onRemove(); onClose(); };

  // Fallback: se mancano sito e Instagram usa una ricerca Google del nome squadra
  const logoLink = safeUrl(s.website || s.instagram ||
    `https://www.google.com/search?q=${encodeURIComponent(s.nome + " basket 3x3")}`);
  const logoTitle = s.website
    ? `Vai al sito di ${s.nome}`
    : s.instagram
      ? `Instagram di ${s.nome}`
      : `Cerca "${s.nome}" su Google`;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 text-[13.5px]"><span className="w-28 shrink-0 text-chalk-muted">{label}</span><span className="font-semibold text-chalk">{value}</span></div>
  );

  return (
    <Modal label={`Scheda squadra ${s.nome}`} title={s.nome} width={520} onClose={onClose}
      subtitle={Number(s.rank) > 0 ? `Ranking circuito: ${s.rank} pt` : undefined}>
      {/* Logo centrato — sempre cliccabile: sito > instagram > ricerca Google */}
      <div className="mb-4 flex justify-center">
        {s.logo ? (
          <a href={logoLink} target="_blank" rel="noopener noreferrer" title={logoTitle}>
            <img src={safeUrl(s.logo)} alt={`Logo ${s.nome}`} className="h-32 w-32 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </a>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-sm bg-asphalt-800 font-display text-3xl text-chalk-muted">3×3</div>
        )}
      </div>

      {/* ── Modalità visualizzazione ── */}
      {!editing && (
        <>
          <div className="mb-4 flex flex-col gap-1.5">
            {s.citta && row("Città", <>{s.citta}{s.anno ? ` · fondata nel ${s.anno}` : ""}</>)}
            {!s.citta && s.anno && row("Fondata", s.anno)}
            {s.referente && row("Referente", s.referente)}
            {s.website && row("Sito web", <a href={safeUrl(s.website)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">{s.website.replace(/^https?:\/\//, "")}</a>)}
            {s.instagram && row("Instagram", <a href={safeUrl(s.instagram)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">
              @{s.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "").replace(/\/$/, "")}
            </a>)}
          </div>

          {/* Roster */}
          {(s.roster || []).length > 0 && (
            <div className="mb-4 rounded border border-asphalt-700 bg-asphalt-950/60 p-3.5">
              <div className="kicker mb-2">Roster ({s.roster.length})</div>
              <div className="flex flex-col divide-y divide-asphalt-700/60">
                {s.roster.map((id) => <div key={id} className="py-1.5 text-sm font-semibold text-chalk">{gName(id)}</div>)}
              </div>
            </div>
          )}

          {s.note && <p className="mb-4 text-[13.5px] text-chalk-muted">{s.note}</p>}
        </>
      )}

      {/* ── Modalità modifica ── */}
      {editing && (
        <div className="mb-4 flex flex-col gap-2.5">
          <div className="grid-auto">
            <Input label="Nome squadra" value={draft.nome} onChange={set("nome")} />
            <Input label="Città" value={draft.citta} onChange={set("citta")} />
            <Input label="Anno fondazione" type="number" value={draft.anno} onChange={set("anno")} />
            <Input label="Ranking (pt)" type="number" min={0} value={draft.rank} onChange={set("rank")} />
            <Input label="Referente / capitano" value={draft.referente} onChange={set("referente")} />
            <Input label="Logo (URL)" value={draft.logo} onChange={set("logo")} placeholder="/logos/squadra.svg" />
            <Input label="Sito web" value={draft.website} onChange={set("website")} placeholder="https://squadra.it" />
            <Input label="Instagram" value={draft.instagram} onChange={set("instagram")} placeholder="https://instagram.com/squadra" />
          </div>
          <Input label="Note" value={draft.note} onChange={set("note")} placeholder="es. campioni tappa Roma 2025" />
          <div className="mt-1 flex gap-2">
            <Button onClick={saveEdit}>Salva modifiche</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {/* Footer: autore + azioni */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-asphalt-700 pt-3">
        <span className="text-[10.5px] text-chalk-dim">Registrata da {s.autore}</span>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> Modifica</Button>
            <Button variant="ghost" size="sm" className="text-loss" onClick={handleRemove}><Icon name="trash" size={14} /> Elimina</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
