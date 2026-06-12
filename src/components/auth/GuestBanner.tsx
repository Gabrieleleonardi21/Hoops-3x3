import { RED } from "../../constants/colors";
import { useAppStore } from "../../stores/useAppStore";

export function GuestBanner({ text }: { text: string }) {
  const user = useAppStore((s) => s.user);
  if (!user?.guest) return null;
  return (
    <p className="ui" style={{ background: "var(--card)", border: `1.5px solid ${RED}`, color: RED, fontWeight: 700, fontSize: 13.5, padding: "10px 14px" }}>
      {text}
    </p>
  );
}
