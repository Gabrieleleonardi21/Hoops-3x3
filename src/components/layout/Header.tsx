/** Barra superiore globale: logo (→ home), navigazione principale, utente e logout.
 *  Sticky con sfondo semitrasparente; la hero vive nella HomePage, non qui. */
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const links = [
  ["/", "Home"],
  ["/leghe", "Le mie leghe"],
  ["/anagrafe", "Anagrafe"],
  ["/archivio", "Archivio circuito"],
  ["/campetti", "Campetti"],
] as const;

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-asphalt-700 bg-asphalt-950/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0" aria-label="HOOP 3X3, vai alla home">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-sm" />
            <span className="font-display text-2xl text-chalk">HOOP <span className="text-court">3X3</span></span>
          </button>

          {user && (
            <span className="hidden sm:flex items-center gap-2 text-[13px] text-chalk-muted">
              <span className="text-chalk font-medium">{user.name}</span>
              {user.guest && <span className="text-chalk-dim">(ospite)</span>}
              <button onClick={() => { logout(); navigate("/"); }}
                className="ml-2 inline-flex items-center gap-1 rounded border border-asphalt-700 px-2.5 h-8 text-xs font-semibold uppercase tracking-[0.08em] hover:border-asphalt-500 hover:text-chalk">
                Esci
              </button>
            </span>
          )}
          {!user && <span className="text-xs uppercase tracking-[0.12em] text-chalk-muted">Circuito italiano 3x3</span>}
        </div>

        {/* Navigazione: su mobile scorre in orizzontale invece di andare a capo */}
        {user && (
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Principale">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}
                className={({ isActive }) =>
                  `shrink-0 border-b-2 px-3 py-2.5 font-display text-[15px] transition-colors ${
                    isActive ? "border-court text-chalk" : "border-transparent text-chalk-muted hover:text-chalk"}`}>
                {label}
              </NavLink>
            ))}
            {/* su mobile il logout sta nella riga di navigazione (l'utente in alto è nascosto) */}
            <button onClick={() => { logout(); navigate("/"); }} className="ml-auto shrink-0 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-chalk-muted hover:text-chalk sm:hidden">
              Esci{user.guest ? " (ospite)" : ""}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
