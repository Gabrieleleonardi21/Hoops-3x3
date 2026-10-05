/** Rete di sicurezza per gli errori di disegno: se una pagina lancia un'eccezione mentre si disegna (dati salvati o ricevuti in
 *  una forma inattesa), React smonta l'intera applicazione e resta la pagina bianca. Qui l'errore resta dentro la pagina:
 *  compare un messaggio con «Ricarica», e intestazione e navigazione restano visibili. Deve essere una classe: i boundary non
 *  esistono come funzioni. L'errore in sé lo registra già React sulla console. */
import { Component, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  /** Quando cambia (per esempio il percorso della pagina aperta) un errore precedente si dimentica e i figli si disegnano
   *  di nuovo: chi cambia pagina dal menu non resta bloccato sul messaggio */
  resetKey?: string;
}

export class ErrorBoundary extends Component<Props, { errore: boolean }> {
  state = { errore: false };

  static getDerivedStateFromError() {
    return { errore: true };
  }

  componentDidUpdate(prima: Props) {
    if (this.state.errore && prima.resetKey !== this.props.resetKey) this.setState({ errore: false });
  }

  render() {
    if (!this.state.errore) return this.props.children;
    return (
      <div role="alert" className="rounded border border-loss/40 bg-loss/10 p-4 text-[13px] text-chalk">
        <p className="m-0 font-semibold">Qualcosa è andato storto: questa pagina non si può mostrare.</p>
        <p className="mt-1 mb-3 text-chalk-muted">Ricarica per riprovare; se succede ancora, apri un'altra pagina dal menu.</p>
        <Button size="sm" onClick={() => window.location.reload()}>Ricarica</Button>
      </div>
    );
  }
}
