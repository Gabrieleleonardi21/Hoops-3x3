/** Sanitizza un URL dinamico (logo, sito, Instagram, video scritti da un utente): accetta solo http/https e i percorsi relativi
 *  al sito (/...). Blocca javascript:, data:, vbscript: e ogni altro schema, gli URL malformati e i percorsi «protocol-relative»
 *  (//host, o /\host che i browser leggono allo stesso modo), che porterebbero su un altro sito. Chi blocca riceve "#". */
export function safeUrl(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  // Percorso relativo al sito: il secondo carattere non può essere / né \, altrimenti è un altro host
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "#";
    return trimmed;
  }
  try {
    // new URL normalizza lo schema (maiuscole, spazi e tabulazioni dentro «java script:» compresi): basta confrontare il protocollo
    const u = new URL(trimmed);
    if (u.protocol === "https:" || u.protocol === "http:") return trimmed;
  } catch { /* URL non valido */ }
  return "#"; // schema non sicuro o URL malformato: blocca
}
