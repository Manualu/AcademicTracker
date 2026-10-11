import { useState, type FormEvent } from "react";
import { IsoFloor } from "../components/IsoFloor";
import { backend, useStore } from "../lib/store";

export default function Login() {
  const { setUserId } = useStore();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "in") {
        await backend.signIn(email.trim(), password);
      } else {
        if (password.length < 8) throw new Error("La contraseña tiene que tener al menos 8 caracteres.");
        const r = await backend.signUp(email.trim(), password, name.trim(), code.trim());
        if (r.needsConfirmation) {
          setInfo("Te mandamos un mail para confirmar la cuenta. Después volvé e iniciá sesión.");
          setMode("in");
          return;
        }
      }
      setUserId(await backend.currentUserId());
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : "Necesitás conexión para iniciar sesión la primera vez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="console login-hero">
        <p className="eyebrow">Tratado de la Remontada · FIUBA</p>
        <h1 className="wordmark">Remontada<span>.</span></h1>
        <p>Horas de estudio, actividad física y exámenes del grupo. Todo a la vista de todos.</p>
        <div style={{ margin: "4px -4px -6px" }}>
          <IsoFloor pieces={["horno", "torno", "robot", "motor", "engranaje", "tornillo"]} />
        </div>
      </section>
      <div className="login-form stack">
      {backend.isDemo && (
        <p className="callout small" style={{ margin: 0 }}>
          Estás viendo la demo: los datos son de prueba y quedan solo en este navegador. Tocá el botón para entrar.
        </p>
      )}
      <form className="stack" onSubmit={submit}>
        <div className="seg" role="group" aria-label="Modo">
          <button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>Iniciar sesión</button>
          <button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>Crear cuenta</button>
        </div>
        {mode === "up" && (
          <label className="field">
            <span>Cómo te llaman</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required={!backend.isDemo} autoComplete="nickname" />
          </label>
        )}
        <label className="field">
          <span>Mail</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!backend.isDemo} autoComplete="email" />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!backend.isDemo}
            autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        {mode === "up" && (
          <label className="field">
            <span>Código del grupo</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required={!backend.isDemo} autoCapitalize="characters" />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        {info && <p className="small">{info}</p>}
        <button className="btn primary big block" disabled={busy}>
          {mode === "in" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>
      </div>
    </div>
  );
}
