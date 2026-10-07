/** Il logo di una squadra, in un posto solo (FP-5): l'indirizzo passa da safeUrl, e un logo che manca, che safeUrl blocca o che
 *  non si carica lascia il posto al ripiego (o a niente). */
import { useState, type ReactNode } from "react";
import { safeUrl } from "../../utils/safeUrl";

export function TeamLogo({ src, alt = "", className, ripiego = null }: {
  src: string | null | undefined;
  /** Vuoto per un logo accanto al nome della squadra: il nome lo dice già */
  alt?: string;
  /** Misure e margini; object-contain c'è sempre */
  className: string;
  ripiego?: ReactNode;
}) {
  // L'indirizzo che non si è caricato: cambiando logo si riprova
  const [rotto, setRotto] = useState<string | null>(null);
  const url = safeUrl(src);
  if (!src || url === "#" || rotto === src) return <>{ripiego}</>;
  return <img src={url} alt={alt} className={`object-contain ${className}`} onError={() => setRotto(src)} />;
}
