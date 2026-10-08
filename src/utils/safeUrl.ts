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
