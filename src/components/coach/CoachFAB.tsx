export function CoachFAB({ onClick }: { onClick: () => void }) {
  return (
    <button className="chatfab" onClick={onClick} aria-label="Apri Coach AI">
      <img src="/logo.png" alt="" />
    </button>
  );
}
