/** La tabella di stagione con i suoi stati: l'attesa mentre l'archivio risponde, l'errore con «Riprova» se non risponde, poi la
 *  tabella. Sta in un componente a sé perché la richiesta parta solo quando la scheda «Statistiche» è aperta. */
import { useStatisticheCircuito } from "../../hooks/useStatisticheCircuito";
import { ErroreCaricamento } from "../ui/ErroreCaricamento";
import { Loading } from "../ui/Loading";
import { StatsCircuito } from "./StatsCircuito";
import type { Anagrafe } from "../../utils/statGiocatori";

/** `anagrafe` viene dalla pagina dell'anagrafe: con lei le statistiche riconoscono i giocatori per id */
export function StatisticheCircuito({ anagrafe }: { anagrafe?: Anagrafe }) {
  const { tappe, errore, reload } = useStatisticheCircuito();
  if (errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare le statistiche." motivo={errore} onRiprova={reload} />;
  }
  if (tappe === null) return <Loading>Sto calcolando le statistiche…</Loading>;
  return <StatsCircuito tappe={tappe} anagrafe={anagrafe} />;
}
