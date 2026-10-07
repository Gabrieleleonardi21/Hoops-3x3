import { useEffect } from "react";

// Finestre aperte adesso, e il valore di overflow da rimettere quando si chiude l'ultima. Con una finestra sopra un'altra (la
// conferma sopra la scheda dell'anagrafe) l'ordine in cui React le smonta non conta: lo scroll torna solo quando non ce n'è
// più nessuna. Con una `prev` per finestra, la prima a chiudersi rimetterebbe il valore di prima mentre l'altra è ancora
// aperta, e l'ultima a chiudersi rimetterebbe «hidden»: la pagina non scorrerebbe più fino al ricaricamento.
let aperte = 0;
let primaDiAprire = "";

/** Blocca lo scroll del body mentre il componente è montato (es. quando una modale è aperta). Con più finestre aperte insieme
 *  lo scroll resta bloccato finché non si chiude l'ultima, in qualunque ordine si chiudano. */
export function useScrollLock() {
  useEffect(() => {
    if (aperte === 0) primaDiAprire = document.body.style.overflow;
    aperte += 1;
    document.body.style.overflow = "hidden";
    return () => {
      aperte -= 1;
      if (aperte === 0) document.body.style.overflow = primaDiAprire;
    };
  }, []);
}
