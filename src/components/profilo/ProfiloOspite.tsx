/** Il profilo per chi è entrato come Ospite: non c'è un account, quindi niente form e nessuna richiesta al server */
export function ProfiloOspite() {
  return (
    <section aria-label="Profilo dell'ospite" className="rounded border border-asphalt-600 bg-asphalt-900/95 p-5">
      <h2 className="mt-0 mb-3 font-display text-2xl text-chalk">Il tuo account</h2>
      <p className="m-0 text-sm text-chalk-muted">
        Sei entrato come Ospite: i tuoi dati restano in questo browser e non c'è un account da gestire. Per averne uno, esci e scegli «Registrati».
      </p>
    </section>
  );
}
