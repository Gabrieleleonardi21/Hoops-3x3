/** Pulsante riutilizzabile. Varianti: primary (arancio), outline, ghost, link.
 *  `size="sm"` per le azioni secondarie dentro card e tabelle.
 *  Le classi passate con `className` vincono su quelle della variante e della misura: si uniscono con tailwind-merge, che toglie la
 *  classe della variante quando l'esterno ne mette una dello stesso tipo (`text-chalk-muted` al posto di `text-court`). Con le classi
 *  solo in fila decideva l'ordine delle regole nel CSS generato, e in produzione perdevano. */
import type { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type Variant = "primary" | "outline" | "ghost" | "link";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

// area-tocco: col dito (schermi stretti, puntatore grossolano) ogni pulsante arriva a 44 px di altezza e di larghezza (vedi index.css)
const base = "area-tocco inline-flex items-center justify-center gap-2 rounded font-display font-semibold transition-colors duration-200 select-none whitespace-nowrap";
const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-5 text-[15px]" };
const variants: Record<Variant, string> = {
  primary: "bg-court text-asphalt-950 hover:bg-court-hover",
  outline: "border border-asphalt-500 text-chalk hover:bg-asphalt-800 hover:border-chalk",
  ghost: "text-chalk-muted hover:text-chalk hover:bg-asphalt-800",
  // I collegamenti si sono sempre visti in maiuscolo, con tracking e interlinea stretti: li portava la classe .font-display (oltre al
  // font), rimasta nella base accanto a font-sans. Con tailwind-merge font-sans sostituisce font-display, quindi lo stesso aspetto si
  // scrive qui e la pagina non cambia. Per il testo normale basta togliere uppercase, tracking e leading
  link: "font-sans text-[13px] text-court uppercase tracking-[-0.01em] leading-none hover:underline underline-offset-4 h-auto px-0",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: Props) {
  const sizeCls = variant === "link" ? "" : sizes[size];
  return <button type={type} className={twMerge(base, sizeCls, variants[variant], className)} {...rest} />;
}
