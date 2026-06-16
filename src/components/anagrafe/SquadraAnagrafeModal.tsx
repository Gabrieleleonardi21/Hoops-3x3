import { useState } from "react";
import { INK, ORANGE, PAPER, RED, RULE } from "../../constants/colors";
import { Input } from "../ui/Input";
import type { RegGiocatore, RegSquadra, User } from "../../types";
import { useScrollLock } from "../../hooks/useScrollLock";

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
  useScrollLock();

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
  const logoLink = s.website || s.instagram ||
    `https://www.google.com/search?q=${encodeURIComponent(s.nome + " basket 3x3")}`;
  const logoTitle = s.website
    ? `Vai al sito di ${s.nome}`
    : s.instagram
      ? `Instagram di ${s.nome}`
      : `Cerca "${s.nome}" su Google`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(23,32,58,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda squadra ${s.nome}`}
        style={{ background: "var(--card)", border: `2px solid ${INK}`, width: "min(500px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 24 }}
      >
        {/* Pulsante chiudi */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={onClose} className="linkbtn" style={{ color: INK, fontSize: 22 }} aria-label="Chiudi">×</button>
        </div>

        {/* Logo centrato — sempre cliccabile: sito > instagram > ricerca Google */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {s.logo ? (
            <a href={logoLink} target="_blank" rel="noopener noreferrer" title={logoTitle}>
              <img
                src={s.logo}
                alt={`Logo ${s.nome}`}
                style={{ width: 130, height: 130, objectFit: "contain", cursor: "pointer" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </a>
          ) : (
            <div style={{ width: 100, height: 100, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--card)", fontSize: 28, fontFamily: "var(--disp)" }}>3×3</span>
            </div>
          )}
        </div>

        {/* Nome */}
        <div className="disp" style={{ fontSize: 26, textTransform: "uppercase", textAlign: "center", borderBottom: `3px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
          {s.nome}
        </div>

        {/* ── Modalità visualizzazione ── */}
        {!editing && (
          <>
            <div className="ui" style={{ fontSize: 13.5, lineHeight: 1.9, marginBottom: 14 }}>
              {Number(s.rank) > 0 && (
                <div style={{ fontWeight: 700, color: ORANGE }}>Ranking circuito: {s.rank} pt</div>
              )}
              {s.citta && (
                <div>Città: <strong>{s.citta}</strong>{s.anno ? ` · Fondata nel ${s.anno}` : ""}</div>
              )}
              {!s.citta && s.anno && <div>Fondata nel <strong>{s.anno}</strong></div>}
              {s.referente && <div>Referente / capitano: <strong>{s.referente}</strong></div>}
              {s.website && (
                <div>
                  Sito web:{" "}
                  <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE, fontWeight: 700 }}>
                    {s.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {s.instagram && (
                <div>
                  Instagram:{" "}
                  {/* mostra solo il @handle per leggibilità */}
                  <a href={s.instagram} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE, fontWeight: 700 }}>
                    @{s.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
            </div>

            {/* Roster */}
            {(s.roster || []).length > 0 && (
              <div style={{ background: PAPER, border: `1px solid ${RULE}`, padding: 14, marginBottom: 14 }}>
                <div className="ui" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Roster ({s.roster.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {s.roster.map((id) => (
                    <div key={id} className="ui" style={{ fontSize: 14, fontWeight: 700, borderBottom: `1px dotted ${RULE}`, paddingBottom: 4 }}>
                      {gName(id)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {s.note && <p style={{ fontSize: 13.5, fontStyle: "italic", margin: "0 0 14px" }}>{s.note}</p>}
          </>
        )}

        {/* ── Modalità modifica ── */}
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={saveEdit} className="blackbtn" style={{ padding: "10px 18px" }}>Salva modifiche</button>
              <button onClick={() => setEditing(false)} className="linkbtn" style={{ color: INK }}>Annulla</button>
            </div>
          </div>
        )}

        {/* Footer: autore + azioni */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${RULE}`, paddingTop: 10, marginTop: 4, gap: 8, flexWrap: "wrap" }}>
          <span className="ui" style={{ fontSize: 10.5, opacity: 0.5 }}>Registrata da {s.autore}</span>
          {canEdit && !editing && (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setEditing(true)} className="linkbtn" style={{ color: INK }}>Modifica</button>
              <button onClick={handleRemove} className="linkbtn" style={{ color: RED }}>Elimina squadra</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
