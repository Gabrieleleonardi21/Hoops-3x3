/** Form di autenticazione: usa react-hook-form + Zod per la validazione dei campi.
 *  L'autenticazione è dimostrativa (client-side SHA-256 + localStorage), non adatta alla produzione. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { INK, RED, RULE } from "../../constants/colors";
import { Input } from "../ui/Input";

const registerSchema = z.object({
  name: z.string().min(1, "Inserisci il nome utente"),
  email: z.string().email("Mail non valida"),
  pass: z.string().min(8, "Password di almeno 8 caratteri"),
});
const loginSchema = z.object({
  email: z.string().email("Mail non valida"),
  pass: z.string().min(1, "Inserisci la password"),
});
type RegisterData = z.infer<typeof registerSchema>;
type LoginData = z.infer<typeof loginSchema>;

export function AuthForm() {
  const { account, register: doRegister, login: doLogin, enterGuest } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"register" | "login">(account ? "login" : "register");
  const [authError, setAuthError] = useState<string | null>(null);

  const regForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });
  const logForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onRegister = regForm.handleSubmit(async (d) => {
    setAuthError(null);
    await doRegister(d.name, d.email, d.pass);
    navigate("/lega");
  });

  const onLogin = logForm.handleSubmit(async (d) => {
    setAuthError(null);
    const ok = await doLogin(d.email, d.pass);
    if (!ok) { setAuthError("Mail o password non corretti."); return; }
    navigate("/lega");
  });

  const err = (m?: string) =>
    m ? <span className="ui t-red" style={{ fontSize: 11.5, fontWeight: 700 }}>{m}</span> : null;

  return (
    <section style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 24, maxWidth: 480 }}>
      <div className="flex gap-16" style={{ marginBottom: 14 }}>
        <button className="linkbtn" style={{ color: mode === "register" ? RED : INK, fontSize: 15 }}
          onClick={() => { setMode("register"); setAuthError(null); }}>Registrati</button>
        <button className="linkbtn" style={{ color: mode === "login" ? RED : INK, fontSize: 15 }}
          onClick={() => { setMode("login"); setAuthError(null); }}>Accedi</button>
      </div>

      {mode === "register" ? (
        <div>
          <Input label="Nome utente" labelClassName="form-label" placeholder="Es. Gabriele" {...regForm.register("name")} />
          {err(regForm.formState.errors.name?.message)}
          <Input label="Mail" labelClassName="form-label" type="email" placeholder="nome@mail.it" {...regForm.register("email")} />
          {err(regForm.formState.errors.email?.message)}
          <Input label="Password" labelClassName="form-label" labelStyle={{ marginBottom: 4 }} type="password" {...regForm.register("pass")} />
          {err(regForm.formState.errors.pass?.message)}
          <p style={{ fontSize: 12.5, fontStyle: "italic", margin: "6px 0 12px" }}>
            Nota: è un accesso dimostrativo salvato solo su questo browser, non usare una password che utilizzi altrove.
          </p>
          <button onClick={onRegister} className="disp fullw up t-paper"
            style={{ padding: 13, fontSize: 16, background: INK, border: "none", cursor: "pointer" }}>
            Crea account
          </button>
        </div>
      ) : (
        <div>
          {!account && <p style={{ fontSize: 14, fontStyle: "italic" }}>Nessun account trovato su questo browser: registrati per salvare la tua lega.</p>}
          <Input label="Mail" labelClassName="form-label" type="email" {...logForm.register("email")} />
          {err(logForm.formState.errors.email?.message)}
          <Input label="Password" labelClassName="form-label" labelStyle={{ marginBottom: 14 }} type="password" {...logForm.register("pass")} />
          {err(logForm.formState.errors.pass?.message)}
          <button onClick={onLogin} className="disp fullw up t-paper"
            style={{ padding: 13, fontSize: 16, background: INK, border: "none", cursor: "pointer" }}>
            Accedi
          </button>
        </div>
      )}

      {authError && <p className="ui t-red" style={{ fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>{authError}</p>}

      <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 18, paddingTop: 14 }}>
        <button onClick={() => { enterGuest().then(() => navigate("/lega")); }} className="redbtn fullw">
          Continua come Ospite
        </button>
        <p style={{ fontSize: 12.5, fontStyle: "italic", margin: "8px 0 0" }}>
          I dati dell'Ospite vengono salvati solo su questo browser. I controlli obbligatori su roster e punti sono disattivati.
        </p>
      </div>
    </section>
  );
}
