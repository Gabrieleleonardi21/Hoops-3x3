import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelStyle?: React.CSSProperties;
  labelClassName?: string; // sostituisce lo stile di default dell'etichetta (es. "form-label")
}

/** Input con etichetta in maiuscoletto, stile "statin" */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, labelStyle, labelClassName, style, ...rest },
  ref
) {
  const input = <input ref={ref} className="statin" style={{ marginTop: label ? 4 : 0, ...style }} {...rest} />;
  if (!label) return input;
  // .input-label è lo stile di default dell'etichetta; labelClassName lo rimpiazza mantenendo il font .ui
  return (
    <label className={`ui ${labelClassName ?? "input-label"}`} style={labelStyle}>
      {label}
      {input}
    </label>
  );
});
