/** Floating Action Button che apre/chiude il pannello Coach AI (posizione fissa via .chatfab). */
export function CoachFAB({ onClick }: { onClick: () => void }) {
  return (
    <button className="chatfab" onClick={onClick} aria-label="Apri Coach AI">
      <img src="/logo.png" alt="" />
    </button>
  );
}
