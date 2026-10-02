/** Superficie base del design system: sfondo asphalt-900, bordo 1px, radius 4.
 *  `accent` aggiunge il bordo superiore arancio 3px che marca la card primaria. */
import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
  padded?: boolean;
}

export function Card({ accent, padded = true, className = "", ...rest }: Props) {
  const top = accent ? " border-t-[3px] border-t-court" : "";
  const pad = padded ? " p-4" : "";
  return <div className={`bg-asphalt-900 border border-asphalt-700 rounded${top}${pad} ${className}`} {...rest} />;
}
