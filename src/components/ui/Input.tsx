import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelStyle?: React.CSSProperties;
}

/** Input con etichetta in maiuscoletto, stile "statin" */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, labelStyle, style, ...rest },
  ref
) {
  const input = <input ref={ref} className="statin" style={{ marginTop: label ? 4 : 0, ...style }} {...rest} />;
  if (!label) return input;
  return (
    <label className="ui" style={{ fontSize: 11, fontWeight: 700, display: "block", ...labelStyle }}>
      {label}
      {input}
    </label>
  );
});
