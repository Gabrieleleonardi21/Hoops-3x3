/** Il piè di pagina comune a tutte le pagine: una sola riga con chi ha creato il sito. Nessun link, nessuna email: solo testo. Sta
 *  in App, subito dopo il contenuto (fuori dal main), così non cambia la navigazione né le pagine. */
export function PiePagina() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-chalk-dim">
      Sito creato da Gabriele Leonardi
    </footer>
  );
}
