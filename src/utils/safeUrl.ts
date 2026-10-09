/** Origine fittizia con cui si prova un percorso relativo: se il parser lo porta su un'altra origine, non era un percorso */
const ORIGINE_DI_PROVA = "http://x.invalid";

/** Sanitizza un URL dinamico (logo, sito, Instagram, video scritti da un utente): accetta solo http/https e i percorsi relativi
 *  al sito (/...). Blocca javascript:, data:, vbscript: e ogni altro schema, gli URL malformati e i percorsi «protocol-relative»
 *  (//host, /\host, o «/ /host» con una tabulazione in mezzo: il browser li legge tutti come un altro sito). Chi blocca riceve "#". */
export function safeUrl(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  try {
    // new URL fa ciò che farebbe il browser: normalizza lo schema (maiuscole, tabulazioni e a capo dentro «java script:»
    // compresi) e risolve un percorso rispetto a un'origine. Basta guardare dove si arriva
    if (trimmed.startsWith("/")) {
      if (new URL(trimmed, ORIGINE_DI_PROVA).origin === ORIGINE_DI_PROVA) return trimmed;
      return "#"; // //host e simili: un altro sito
    }
    const u = new URL(trimmed);
    if (u.protocol === "https:" || u.protocol === "http:") return trimmed;
  } catch { /* URL non valido */ }
  return "#"; // schema non sicuro o URL malformato: blocca
}

/** Caratteri al massimo di un indirizzo scritto dall'utente (logo, sito, Instagram, link di un video): il limite del server (B10) */
export const MAX_URL = 2048;

/** Perché un indirizzo scritto dall'utente non va, o null se va. Lo stesso criterio del server (B10), controllato nei form prima
 *  dell'invio: vuoto va bene (i campi sono facoltativi); altrimenti deve essere un URL http:// o https://, oppure un percorso del
 *  sito (/logos/nome.svg: i loghi integrati), entro MAX_URL caratteri. Deve anche passare safeUrl: un URL malformato o
 *  «protocol-relative» (//host) non è un indirizzo, né per noi né per il server. */
export function erroreUrl(valore: string): string | null {
  const v = valore.trim();
  if (!v) return null;
  if (v.length > MAX_URL) return `l'indirizzo può avere al massimo ${MAX_URL} caratteri.`;
  const schemaAmmesso = /^https?:\/\//i.test(v) || v.startsWith("/");
  if (!schemaAmmesso || safeUrl(v) === "#") return "l'indirizzo deve cominciare con http:// o https:// (oppure lascia il campo vuoto).";
  return null;
}

/** Il primo indirizzo non valido tra logo, sito e Instagram di una squadra, con il nome del campo; null se vanno bene tutti.
 *  Lo usano il form e la scheda dell'anagrafe prima di mandare la squadra al server */
export function erroreUrlSquadra(d: { logo: string; website: string; instagram: string }): string | null {
  const campi: [string, string][] = [["Logo", d.logo], ["Sito web", d.website], ["Instagram", d.instagram]];
  for (const [campo, valore] of campi) {
    const errore = erroreUrl(valore);
    if (errore) return `${campo}: ${errore}`;
  }
  return null;
}
