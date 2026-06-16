/** Floating Action Button che apre/chiude il pannello Coach AI.
 *  Posizionato in basso a destra via CSS (.chatfab) ed è sempre visibile. */
export function CoachFAB({ onClick }: { onClick: () => void }) {
  return (
    <button className="chatfab" onClick={onClick} aria-label="Apri Coach AI">
      <img src="/logo.png" alt="" />
    </button>
  );
}
