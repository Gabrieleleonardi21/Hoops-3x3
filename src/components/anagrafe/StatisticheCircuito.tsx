/** La tabella di stagione con i suoi stati: l'attesa mentre l'archivio risponde, l'errore con «Riprova» se non risponde, poi la
 *  tabella. Sta in un componente a sé perché la richiesta parta solo quando la scheda «Statistiche» è aperta. */
import { useStatisticheCircuito } from "../../hooks/useStatisticheCircuito";
import { ErroreCaricamento } from "../ui/ErroreCaricamento";
import { Loading } from "../ui/Loading";
import { StatsCircuito } from "./StatsCircuito";

export function StatisticheCircuito() {
  const { tappe, errore, reload } = useStatisticheCircuito();
  if (errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare le statistiche." motivo={errore} onRiprova={reload} />;
  }
  if (tappe === null) return <Loading>Sto calcolando le statistiche…</Loading>;
  return <StatsCircuito tappe={tappe} />;
}
