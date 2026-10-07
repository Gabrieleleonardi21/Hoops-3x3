/** Form di autenticazione: usa react-hook-form + Zod per la validazione dei campi.
 *  Registrazione e login passano dal backend (JWT); la modalità Ospite resta locale al browser. */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

const ACCOUNT_HINT = "hoop3x3_has_account";
function hasAccountHint(): boolean {
  try { return localStorage.getItem(ACCOUNT_HINT) === "1"; } catch { return false; }
}
function rememberAccount() {
  try { localStorage.setItem(ACCOUNT_HINT, "1"); } catch { /* ignora */ }
}
/** Il backend risponde sempre {message}: si mostra quello, altrimenti un testo generico */
function messaggioErrore(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Errore imprevisto, riprova.";
}
/** Messaggio arrivato con lo stato della navigazione, per esempio quello della fine della sessione (App.tsx) */
function messaggioRicevuto(stato: unknown): string | null {
  const messaggio = (stato as { messaggio?: unknown } | null)?.messaggio;
  if (typeof messaggio === "string") return messaggio;
  return null;
}

const registerSchema = z.object({
  // Da 2 a 80 caratteri come RegisterRequestDTO (gli 80 sono il maxLength del campo); il campo vuoto ha il suo messaggio
  name: z.string().min(1, "Inserisci il nome utente").min(2, "Nome utente di almeno 2 caratteri"),
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
  const { register: doRegister, login: doLogin, enterGuest } = useAuth();
  const navigate = useNavigate();
  const ricevuto = messaggioRicevuto(useLocation().state);
  // Il messaggio si copia qui e si toglie dalla voce della cronologia: resta visibile finché si sta sul form, ma
  // ricaricando la pagina non ricompare (lo stato della navigazione sopravvive al ricaricamento)
  const [copia, setCopia] = useState<string | null>(null);
  useEffect(() => {
    if (ricevuto === null) return;
    setCopia(ricevuto);
    navigate(".", { replace: true, state: null });
  }, [ricevuto, navigate]);
  const avviso = ricevuto ?? copia;
  // Chi ha già usato un account su questo browser parte dal tab "Accedi"
  const [mode, setMode] = useState<"register" | "login">(hasAccountHint() ? "login" : "register");
  const [authError, setAuthError] = useState<string | null>(null);

  const regForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });
  const logForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onRegister = regForm.handleSubmit(async (d) => {
    setAuthError(null);
    try {
      await doRegister(d.name, d.email, d.pass);
      rememberAccount();
      navigate("/lega");
    } catch (e) {
      setAuthError(messaggioErrore(e));
    }
  });

  const onLogin = logForm.handleSubmit(async (d) => {
    setAuthError(null);
    try {
      await doLogin(d.email, d.pass);
      rememberAccount();
      navigate("/lega");
    } catch (e) {
      setAuthError(messaggioErrore(e));
    }
  });

  const tab = (m: "register" | "login", label: string) => (
    <button type="button" onClick={() => { setMode(m); setAuthError(null); }}
      className={`border-b-2 px-1 pb-1.5 font-display text-lg transition-colors ${mode === m ? "border-court text-chalk" : "border-transparent text-chalk-muted hover:text-chalk"}`}
      aria-pressed={mode === m}>
      {label}
    </button>
  );
  const regErr = regForm.formState.errors;
  const logErr = logForm.formState.errors;

  return (
    <section className="rounded border border-asphalt-600 bg-asphalt-900/95 p-5 backdrop-blur" aria-label="Accesso">
      {avviso && <p className="mb-4 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="alert">{avviso}</p>}
      <div className="mb-4 flex gap-5 border-b border-asphalt-700">{tab("register", "Registrati")}{tab("login", "Accedi")}</div>

      {mode === "register" ? (
        <form className="flex flex-col gap-3" onSubmit={onRegister} noValidate>
          <Input label="Nome utente" placeholder="Es. Gabriele" autoComplete="username" maxLength={80} {...regForm.register("name")} error={!!regErr.name} hint={regErr.name?.message} />
          <Input label="Mail" type="email" placeholder="nome@mail.it" autoComplete="email" {...regForm.register("email")} error={!!regErr.email} hint={regErr.email?.message} />
          <Input label="Password" type="password" autoComplete="new-password" {...regForm.register("pass")} error={!!regErr.pass} hint={regErr.pass?.message} />
          <p className="m-0 text-xs text-chalk-muted">
            L'account è salvato sul server: le tue leghe ti seguono su qualsiasi dispositivo.
          </p>
          <Button type="submit" className="w-full">Crea account</Button>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={onLogin} noValidate>
          <Input label="Mail" type="email" autoComplete="email" {...logForm.register("email")} error={!!logErr.email} hint={logErr.email?.message} />
          <Input label="Password" type="password" autoComplete="current-password" {...logForm.register("pass")} error={!!logErr.pass} hint={logErr.pass?.message} />
          <Button type="submit" className="w-full">Accedi</Button>
        </form>
      )}

      {authError && <p className="mt-2.5 text-[13px] font-semibold text-loss" role="alert">{authError}</p>}

      <div className="mt-4 border-t border-asphalt-700 pt-4">
        <Button variant="outline" className="w-full" onClick={() => { enterGuest().then(() => navigate("/lega")); }}>
          Continua come Ospite
        </Button>
        <p className="mt-2 mb-0 text-xs text-chalk-muted">
          I dati dell'Ospite restano su questo browser. I controlli obbligatori su roster e punti sono disattivati.
        </p>
      </div>
    </section>
  );
}
