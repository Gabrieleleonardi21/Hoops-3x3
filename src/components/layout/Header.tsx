/** Header globale: mostra logo (cliccabile → home), titolo, utente e pulsante logout. */
import { INK, RULE } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header style={{ borderBottom: `4px solid ${INK}`, paddingBottom: 14, marginBottom: 6 }}>
        <div className="ui flex between up wrap gap-6" style={{ fontSize: 12, letterSpacing: "0.12em", marginBottom: 6 }}>
          <span>Circuito italiano 3x3</span>
          {user ? (
            <span>
              {user.name}{user.guest ? " (ospite)" : ""} ·{" "}
              <button onClick={() => { logout(); navigate("/"); }} className="linkbtn up"
                style={{ fontSize: 12, letterSpacing: "0.12em" }}>
                Esci
              </button>
            </span>
          ) : (
            <span>Edizione street</span>
          )}
        </div>
        <div className="row gap-16 wrap">
          <img src="/logo.png" alt="Logo HOOP 3X3" onClick={() => navigate(user ? "/leghe" : "/")}
            style={{ width: "clamp(58px, 11vw, 88px)", height: "auto", cursor: "pointer" }} />
          <div>
            <h1 className="disp" style={{ fontSize: "clamp(36px, 8vw, 64px)", lineHeight: 0.95, margin: 0 }}>
              HOOP <span className="t-orange">3X3</span>
            </h1>
            <div className="ui t-orange up" style={{ fontWeight: 700, fontSize: "clamp(11px, 2.4vw, 14px)", letterSpacing: "0.2em", marginTop: 4 }}>
              Analyze. Train. Improve.
            </div>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 16, fontStyle: "italic" }}>
          Crea la tua lega, organizza le tappe, sorteggia i gironi e registra i punteggi. Regole 3x3, niente pareggi.
        </p>
      </header>
      <div style={{ borderBottom: `1px solid ${RULE}`, marginBottom: 26 }} />
    </>
  );
}
