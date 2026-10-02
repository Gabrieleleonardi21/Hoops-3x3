/** Banner informativo mostrato solo agli ospiti (user.guest === true) */
import { useAppStore } from "../../stores/useAppStore";

export function GuestBanner({ text }: { text: string }) {
  const user = useAppStore((s) => s.user);
  if (!user?.guest) return null;
  return (
    <p className="mb-4 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="status">
      <span className="font-semibold text-court">Modalità Ospite.</span> {text.replace(/^Modalità Ospite:\s*/i, "")}
    </p>
  );
}
