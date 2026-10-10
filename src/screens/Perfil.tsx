import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Medal, Piece } from "../components/Piece";
import { Avatar, Icon, Sheet } from "../components/ui";
import { AVATAR_BGS, AVATAR_STYLES, avatarUri, randomSeed, type AvatarStyleKey } from "../lib/avatar";
import { resetDemo } from "../lib/demoBackend";
import { CHATARRA, PIECES } from "../lib/pieces";
import { findPlan } from "../lib/planes";
import { disablePush, enablePush, pushState, type PushState } from "../lib/push";
import { currentStreak, sessionsOf, weekMinutes } from "../lib/stats";
import { backend, useStore } from "../lib/store";
import { fmtHours, fmtMinutes, relativeTime, startOfWeek } from "../lib/time";
import { trophiesFor, type Trophy } from "../lib/trophies";
import type { AvatarConfig, Profile } from "../lib/types";

const THEME_KEY = "remontada.theme";
export function applyTheme(t: string | null) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function AvatarEditor({ me, onClose }: { me: Profile; onClose: () => void }) {
  const { dispatch } = useStore();
  const [cfg, setCfg] = useState<AvatarConfig>(me.avatar);
  const [name, setName] = useState(me.displayName);
  return (
    <Sheet open onClose={onClose} label="Editar perfil">
      <div className="stack">
        <div className="row" style={{ justifyContent: "center" }}>
          <img className="avatar" src={avatarUri(cfg)} width={112} height={112} alt="Vista previa del avatar" />
        </div>
        <button className="btn block" onClick={() => setCfg({ ...cfg, seed: randomSeed() })}>Generar otra cara</button>
        <div className="field">
          <span>Estilo</span>
          <div className="style-grid">
            {(Object.keys(AVATAR_STYLES) as AvatarStyleKey[]).map((k) => (
              <button key={k} aria-pressed={cfg.style === k} onClick={() => setCfg({ ...cfg, style: k })}>
                <img src={avatarUri({ ...cfg, style: k })} width={48} height={48} alt="" style={{ borderRadius: "50%" }} />
                {AVATAR_STYLES[k].name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Fondo</span>
          <div className="swatches">
            {AVATAR_BGS.map((c) => (
              <button key={c} aria-label={`Fondo #${c}`} aria-pressed={cfg.bg === c} style={{ background: `#${c}` }} onClick={() => setCfg({ ...cfg, bg: c })} />
            ))}
          </div>
        </div>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <button className="btn primary big block" disabled={!name.trim()}
          onClick={() => { dispatch({ kind: "profile.update", userId: me.id, patch: { avatar: cfg, displayName: name.trim() } }); onClose(); }}>
          Guardar
        </button>
      </div>
    </Sheet>
  );
}

function Settings({ me }: { me: Profile }) {
  const { dispatch, data, toast, setUserId } = useStore();
  const nav = useNavigate();
  const [push, setPush] = useState<PushState | null>(null);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem(THEME_KEY) ?? "system"; } catch { return "system"; } });
  useEffect(() => { void pushState().then(setPush); }, []);

  const toggle = (k: "notifyFeed" | "notifyWakeup" | "notifyExams" | "notifyWeekly") =>
    dispatch({ kind: "profile.update", userId: me.id, patch: { [k]: !me[k] } });

  async function onPush() {
    try {
      setPush(push === "on" ? await disablePush(backend) : await enablePush(backend));
    } catch (e) {
      toast({ tone: "error", title: "No se pudieron activar los avisos", body: String((e as Error).message) });
    }
  }

  const pushText: Record<PushState, string> = {
    on: "Activados en este celular.",
    off: "Desactivados en este celular.",
    denied: "Bloqueaste los avisos. Habilitalos desde la configuración del navegador.",
    unsupported: "Este navegador no permite avisos.",
    "needs-install": "En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio).",
    "no-server": backend.isDemo ? "En la demo no hay avisos push." : "Falta configurar la clave de avisos en el servidor.",
  };

  const myActs = data.activities.filter((a) => a.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <>
      <div className="section-title"><h2 className="h2">Avisos</h2></div>
      <div className="card">
        <div className="row between">
          <span className="small grow">{push ? pushText[push] : "…"}</span>
          {(push === "on" || push === "off") && (
            <button className="btn" onClick={onPush}><Icon name="bell" size={18} />{push === "on" ? "Desactivar" : "Activar"}</button>
          )}
        </div>
        <div className="dashed" />
        {([
          ["notifyFeed", "Cuando alguien estudia, entrena o agenda un examen"],
          ["notifyWakeup", "8:30, recordatorio de la foto de las 9"],
          ["notifyExams", "Una semana y un día antes de tus exámenes"],
          ["notifyWeekly", "Domingo si te falta algo y lunes con el resumen"],
        ] as const).map(([k, label]) => (
          <label key={k} className="toggle">
            <span className="small">{label}</span>
            <input type="checkbox" className="switch" checked={me[k]} onChange={() => toggle(k)} />
          </label>
        ))}
      </div>

      <div className="section-title"><h2 className="h2">Tema</h2></div>
      <div className="seg" role="group" aria-label="Tema">
        {[["system", "Automático"], ["light", "Papel"], ["dark", "Plano"]].map(([k, l]) => (
          <button key={k} aria-pressed={theme === k} onClick={() => {
            setTheme(k);
            try { localStorage.setItem(THEME_KEY, k); } catch { /* ignorar */ }
            applyTheme(k);
          }}>{l}</button>
        ))}
      </div>

      {myActs.length > 0 && (
        <>
          <div className="section-title"><h2 className="h2">Tu actividad física</h2></div>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <ul className="feed">
              {myActs.map((a) => (
                <li key={a.id} style={{ alignItems: "center" }}>
                  <Icon name="run" />
                  <div className="grow">
                    <div className="what"><b>{a.kind}</b>{a.minutes ? `, ${fmtMinutes(a.minutes)}` : ""}</div>
                    <div className="when">{new Date(`${a.doneOn}T12:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}</div>
                  </div>
                  <button className="btn-ghost" aria-label="Borrar actividad"
                    onClick={() => { if (confirm("¿Borrar esta actividad?")) dispatch({ kind: "activity.delete", id: a.id, userId: me.id }); }}>
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="stack" style={{ marginTop: 26 }}>
        {backend.isDemo && (
          <button className="btn block" onClick={() => { resetDemo(); location.reload(); }}>Reiniciar datos de la demo</button>
        )}
        <button className="btn danger block" onClick={async () => { await backend.signOut(); setUserId(null); nav("/"); }}>Cerrar sesión</button>
        <p className="tiny muted">
          Avatares de DiceBear: {Object.values(AVATAR_STYLES).map((s) => s.credit).join("; ")}. Planes de estudio de FIUBA-Map (MIT).
        </p>
      </div>
    </>
  );
}

export default function Perfil() {
  const { id } = useParams();
  const { data, userId } = useStore();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [trophy, setTrophy] = useState<Trophy | null>(null);
  const p = data.profiles.find((x) => x.id === id);
  const isMe = id === userId;
  const trophies = useMemo(() => (p ? trophiesFor(data, p.id) : []), [data, p]);

  if (!p) return <div className="empty" style={{ paddingTop: 60 }}>No encontramos ese perfil.</div>;

  const ss = sessionsOf(data, p.id);
  const counts = new Map<string, number>();
  ss.forEach((s) => counts.set(s.piece, (counts.get(s.piece) ?? 0) + 1));
  const earned = trophies.filter((t) => t.earned).length;
  const plan = findPlan(p.planId);
  const lastSession = [...ss].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <>
      <div className="profile-hero">
        <button className="btn-ghost" onClick={() => nav(-1)} aria-label="Volver"><Icon name="back" /></button>
        <Avatar profile={p} size={76} />
        <div className="grow">
          <h1 className="h1" style={{ fontSize: "1.9rem" }}>{p.displayName}</h1>
          <div className="small muted">{plan ? `Ing. ${plan.carrera.nombreCorto}` : "Sin carrera elegida"}{lastSession ? `, estudió ${relativeTime(lastSession.createdAt)}` : ""}</div>
        </div>
        {isMe && <button className="btn" onClick={() => setEditing(true)}>Editar</button>}
      </div>

      <div className="stat-grid">
        <div><div className="num">{fmtHours(weekMinutes(ss, startOfWeek()))} h</div><div className="tiny muted">esta semana</div></div>
        <div><div className="num">{currentStreak(ss)}</div><div className="tiny muted">días seguidos</div></div>
        <div><div className="num">{earned}/{trophies.length}</div><div className="tiny muted">trofeos</div></div>
      </div>

      <div className="section-title"><h2 className="h2">Planta</h2><span className="small muted">{ss.length} piezas</span></div>
      <div className="inventory">
        {[...PIECES, CHATARRA].map((pi) => {
          const n = counts.get(pi.key) ?? 0;
          return (
            <div key={pi.key} className={n === 0 ? "zero" : ""} title={pi.blurb}>
              <Piece piece={pi.key} size={44} />
              <span className="num" style={{ fontSize: "1.2rem" }}>{n}</span>
              <span className="tiny muted">{pi.name}</span>
            </div>
          );
        })}
      </div>

      <div className="section-title"><h2 className="h2">Trofeos</h2></div>
      <div className="trophies">
        {trophies.map((t) => (
          <button key={t.id} className={`trophy ${t.earned ? "" : "locked"}`} onClick={() => setTrophy(t)}>
            <Medal glyph={t.glyph} earned={t.earned} />
            <span className="t">{t.name}</span>
          </button>
        ))}
      </div>

      {isMe && <Settings me={p} />}
      {editing && isMe && <AvatarEditor me={p} onClose={() => setEditing(false)} />}
      <Sheet open={!!trophy} onClose={() => setTrophy(null)} label={trophy?.name ?? "Trofeo"}>
        {trophy && (
          <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
            <Medal glyph={trophy.glyph} earned={trophy.earned} size={96} />
            <h2 className="h1" style={{ fontSize: "1.6rem" }}>{trophy.name}</h2>
            <p style={{ margin: 0 }}>{trophy.description}</p>
            <p className="small muted" style={{ margin: 0 }}>{trophy.earned ? "Conseguido" : trophy.progress ?? "Todavía no"}</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
