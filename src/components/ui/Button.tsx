/** Pulsante riutilizzabile. Varianti: primary (arancio), outline, ghost, link.
 *  `size="sm"` per le azioni secondarie dentro card e tabelle. */
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "link";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const base = "inline-flex items-center justify-center gap-2 rounded font-display font-semibold transition-colors duration-200 select-none whitespace-nowrap";
const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-5 text-[15px]" };
const variants: Record<Variant, string> = {
  primary: "bg-court text-asphalt-950 hover:bg-court-hover",
  outline: "border border-asphalt-500 text-chalk hover:bg-asphalt-800 hover:border-chalk",
  ghost: "text-chalk-muted hover:text-chalk hover:bg-asphalt-800",
  link: "font-sans text-[13px] text-court hover:underline underline-offset-4 h-auto px-0",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: Props) {
  const sizeCls = variant === "link" ? "" : sizes[size];
  return <button type={type} className={`${base} ${sizeCls} ${variants[variant]} ${className}`} {...rest} />;
}
