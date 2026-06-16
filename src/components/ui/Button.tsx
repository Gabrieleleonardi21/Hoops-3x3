/** Componente button riutilizzabile con varianti di stile (black, red, link, nav).
 *  In alternativa si possono usare direttamente le classi CSS (blackbtn, redbtn…). */
import type { ButtonHTMLAttributes } from "react";

type Variant = "black" | "red" | "link" | "nav";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

const cls: Record<Variant, string> = {
  black: "blackbtn", red: "redbtn", link: "linkbtn", nav: "navbtn",
};

export function Button({ variant = "black", active, className = "", ...rest }: Props) {
  return <button className={`${cls[variant]}${active ? " active" : ""} ${className}`} {...rest} />;
}
