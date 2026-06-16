/** Barra di navigazione principale: la classe "active" è gestita automaticamente da NavLink. */
import { NavLink } from "react-router-dom";

const links = [
  ["/leghe", "Le mie leghe"],
  ["/anagrafe", "Anagrafe"],
  ["/archivio", "Archivio circuito"],
] as const;

export function NavBar() {
  return (
    <nav className="ui" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => `navbtn${isActive ? " active" : ""}`}
          style={{ textDecoration: "none", display: "inline-block" }}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
