import { Loading } from "../ui/Loading";
import type { PubTappa } from "../../types";
import { INK } from "../../constants/colors";

export function ArchivioList({ pubs, onOpen }: { pubs: PubTappa[] | null; onOpen: (p: PubTappa) => void }) {
  if (pubs === null) return <Loading>Sto aprendo l'archivio del circuito…</Loading>;
  if (!pubs.length)
    return <p style={{ fontStyle: "italic", fontSize: 15 }}>L'archivio è vuoto: nessuna tappa è ancora stata conclusa e pubblicata.</p>;
  return (
    <section style={{ borderTop: `4px solid ${INK}` }}>
      <div className="ui" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 2px", fontWeight: 700 }}>
        Tappe concluse — visibili a tutti gli utenti
      </div>
      {pubs.map((pub, i) => (
        <button key={i} className="tapparow" onClick={() => onOpen(pub)}>
          <span style={{ fontSize: 16 }}>
            <strong className="disp" style={{ fontSize: 15 }}>{pub.tappa?.nome}</strong>
            <span className="ui" style={{ fontSize: 12.5, opacity: 0.7, marginLeft: 8 }}>
              {[pub.lega, pub.tappa?.luogo, pub.tappa?.data].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="ui" style={{ fontSize: 12.5, fontWeight: 700 }}>
            {pub.tappa?.squadre?.length || 0} squadre · di {pub.autore || "?"}
          </span>
        </button>
      ))}
    </section>
  );
}
