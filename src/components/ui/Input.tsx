import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelStyle?: React.CSSProperties;
  labelClassName?: string; // sostituisce lo stile di default dell'etichetta (es. "form-label")
  hint?: string;           // testo di aiuto o errore sotto il campo
  error?: boolean;         // colora hint e bordo come errore
}

/** Input con etichetta piccola in maiuscolo (stile .statin del design system). */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, labelStyle, labelClassName, hint, error, className = "", style, ...rest },
  ref
) {
  const errCls = error ? " border-loss" : "";
  const input = <input ref={ref} className={`statin${errCls} ${className}`} style={{ marginTop: label ? 4 : 0, ...style }} aria-invalid={error || undefined} {...rest} />;
  const hintEl = hint ? <span className={`block mt-1 text-xs ${error ? "text-loss font-semibold" : "text-chalk-muted"}`}>{hint}</span> : null;
  if (!label) return <>{input}{hintEl}</>;
  return (
    <label className={`ui ${labelClassName ?? "input-label"}`} style={labelStyle}>
      {label}
      {input}
      {hintEl}
    </label>
  );
});
