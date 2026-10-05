/** Rete di sicurezza per gli errori di disegno: se una pagina lancia un'eccezione mentre si disegna (dati salvati o ricevuti in
 *  una forma inattesa), React smonta l'intera applicazione e resta la pagina bianca. Qui l'errore resta dentro la pagina:
 *  compare un messaggio con «Ricarica», e intestazione e navigazione restano visibili. Deve essere una classe: i boundary non
 *  esistono come funzioni. L'errore in sé lo registra già React sulla console. */
import { Component, type ReactNode } from "react";
import { ErroreCaricamento } from "./ErroreCaricamento";

interface Props {
  children: ReactNode;
  /** Quando cambia (per esempio il percorso della pagina aperta) un errore precedente si dimentica e i figli si disegnano
   *  di nuovo: chi cambia pagina dal menu non resta bloccato sul messaggio */
  resetKey?: string;
}

interface Stato {
  errore: boolean;
}

export class ErrorBoundary extends Component<Props, Stato> {
  state = { errore: false };

  static getDerivedStateFromError() {
    return { errore: true };
  }

  componentDidUpdate(prima: Props, statoPrima: Stato) {
    // Si azzera solo se l'errore c'era già prima di questo aggiornamento: passando da una pagina buona a una rotta la chiave
    // cambia nello stesso commit in cui compare l'errore, e azzerare farebbe disegnare e rompere la pagina una seconda volta
    if (statoPrima.errore && this.state.errore && prima.resetKey !== this.props.resetKey) this.setState({ errore: false });
  }

  render() {
    if (!this.state.errore) return this.props.children;
    return (
      <ErroreCaricamento cosa="Qualcosa è andato storto: questa pagina non si può mostrare."
        motivo="Ricarica per riprovare; se succede ancora, apri un'altra pagina dal menu."
        azione="Ricarica" onRiprova={() => window.location.reload()} />
    );
  }
}
