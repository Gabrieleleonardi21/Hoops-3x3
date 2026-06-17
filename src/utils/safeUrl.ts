/** Sanitizza un URL dinamico: accetta solo http/https e path relativi (/...).
 *  Blocca javascript:, data: e qualsiasi altro schema pericoloso. */
export function safeUrl(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed; // path relativo sicuro
  try {
    const u = new URL(trimmed);
    if (u.protocol === "https:" || u.protocol === "http:") return trimmed;
  } catch { /* URL non valido */ }
  return "#"; // schema non sicuro o URL malformato: blocca
}
