// L'import rende questo file un MODULO: così `declare module "react"` ESTENDE
// (merge) i tipi di React invece di rimpiazzarli. Consente di usare le custom
// property CSS (es. `--min` per la classe .grid-auto) negli `style` inline senza cast.
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}
