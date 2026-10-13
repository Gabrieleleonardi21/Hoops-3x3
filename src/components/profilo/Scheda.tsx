/** Pezzi comuni delle schede del profilo: il riquadro con il titolo e l'esito di un invio (conferma o errore del server) */
import type { ReactNode } from "react";

/** Una scheda del profilo: sezione con nome (per chi usa il lettore di schermo) e la classe delle card del sito */
export function Scheda({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section aria-label={titolo} className="rounded border border-asphalt-600 bg-asphalt-900/95 p-5">
      <h3 className="mt-0 mb-3 font-display text-xl text-chalk">{titolo}</h3>
      {children}
    </section>
  );
}

/** Sotto il form: il messaggio di riuscita (status) o il motivo del rifiuto del server (alert), com'è. Il testo è sempre un nodo di
 *  testo: viene dal server o da chi scrive, mai HTML */
export function Esito({ messaggio, errore }: { messaggio: string | null; errore: string | null }) {
  return (
    <>
      {messaggio && (
        <p className="m-0 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="status">{messaggio}</p>
      )}
      {errore && <p className="m-0 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
    </>
  );
}
