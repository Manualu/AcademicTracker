import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IsoPiece } from "../components/IsoPiece";
import { Medal } from "../components/Medal";
import { Avatar, Icon, Sheet } from "../components/ui";
import { AVATAR_BGS, AVATAR_STYLES, avatarUri, randomSeed, type AvatarStyleKey } from "../lib/avatar";
import { resetDemo } from "../lib/demoBackend";
import { PieceSheet } from "../components/PieceSheet";
import { starsOf } from "../iso/park";
import { CATALOG, inventoryOf, pieceDef, RARITY_RANK } from "../lib/catalog";
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
    <Sheet open onClose={onClose} label="Editar perfil" title="Tu perfil" eyebrow="Avatar y nombre">
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ justifyContent: "center", gap: 16 }}>
          <img className="avatar" src={avatarUri(cfg)} width={112} height={112} alt="Vista previa del avatar" style={{ boxShadow: "0 0 0 4px var(--bg), 0 0 0 6px var(--yellow)" }} />
        </div>
        <button className="btn block" onClick={() => setCfg({ ...cfg, seed: randomSeed() })}><Icon name="dice" size={20} />Generar otra cara</button>
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
      <div className="card settings">
        <div className="toggle">
          <span className="ti"><Icon name="bell" size={18} /></span>
          <span className="small grow">{push ? pushText[push] : "…"}</span>
          {(push === "on" || push === "off") && (
            <button className={`btn sm ${push === "off" ? "primary" : ""}`} onClick={onPush}>{push === "on" ? "Desactivar" : "Activar"}</button>
          )}
        </div>
        {([
          ["notifyFeed", "users", "Cuando alguien estudia, entrena o agenda un examen"],
          ["notifyWakeup", "sun", "8:30, recordatorio de la foto de las 9"],
          ["notifyExams", "calendar", "Una semana y un día antes de tus exámenes, y el día de tus sesiones grupales"],
          ["notifyWeekly", "rank", "Domingo si te falta algo y lunes con el resumen"],
        ] as const).map(([k, ico, label]) => (
          <label key={k} className="toggle">
            <span className="ti"><Icon name={ico} size={18} /></span>
            <span className="small grow">{label}</span>
            <input type="checkbox" className="switch" checked={me[k]} onChange={() => toggle(k)} />
          </label>
        ))}
      </div>

      <div className="section-title"><h2 className="h2">Tema</h2></div>
      <div className="seg" role="group" aria-label="Tema">
        {[["system", "Automático", "gear"], ["light", "Papel", "sun"], ["dark", "Plano azul", "moon"]].map(([k, l, ico]) => (
          <button key={k} aria-pressed={theme === k} className="row" style={{ justifyContent: "center", gap: 6 }} onClick={() => {
            setTheme(k);
            try { localStorage.setItem(THEME_KEY, k); } catch { /* ignorar */ }
            applyTheme(k);
          }}><Icon name={ico} size={16} />{l}</button>
        ))}
      </div>

      {myActs.length > 0 && (
        <>
          <div className="section-title"><h2 className="h2">Tu actividad física</h2></div>
          <div className="card tight">
            <ul className="feed">
              {myActs.map((a) => (
                <li key={a.id}>
                  <span className="thumb" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="run" /></span>
                  <div className="grow">
                    <div className="what"><b>{a.kind}</b>{a.minutes ? ` · ${fmtMinutes(a.minutes)}` : ""}</div>
                    <div className="when">{new Date(`${a.doneOn}T12:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}</div>
                  </div>
                  <button className="icon-btn" aria-label="Borrar actividad"
                    onClick={() => { if (confirm("¿Borrar esta actividad?")) dispatch({ kind: "activity.delete", id: a.id, userId: me.id }); }}>
                    <Icon name="trash" size={19} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="stack" style={{ marginTop: 28 }}>
        {backend.isDemo && (
          <button className="btn block" onClick={() => { resetDemo(); location.reload(); }}><Icon name="sync" size={18} />Reiniciar datos de la demo</button>
        )}
        <button className="btn danger block" onClick={async () => { await backend.signOut(); setUserId(null); nav("/"); }}><Icon name="logout" size={18} />Cerrar sesión</button>
        <p className="tiny faint center">
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
  const [piece, setPiece] = useState<string | null>(null);
  const p = data.profiles.find((x) => x.id === id);
  const isMe = id === userId;
  const trophies = useMemo(() => (p ? trophiesFor(data, p.id) : []), [data, p]);

  if (!p) return <div className="empty" style={{ paddingTop: 60 }}>No encontramos ese perfil.</div>;

  const ss = sessionsOf(data, p.id);
  const counts = inventoryOf(data, p.id);
  const owned = [...counts.entries()].filter(([k]) => k !== "chatarra").map(([k, n]) => ({ d: pieceDef(k), n }))
    .sort((a, b) => RARITY_RANK[b.d.r] - RARITY_RANK[a.d.r] || b.d.tier - a.d.tier || b.n - a.n);
  const scrap = counts.get("chatarra") ?? 0;
  const earned = trophies.filter((t) => t.earned).length;
  const plan = findPlan(p.planId);
  const lastSession = [...ss].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const totalMin = ss.reduce((a, s) => a + s.minutes, 0);
  const sortedTrophies = [...trophies].sort((a, b) => Number(b.earned) - Number(a.earned));

  return (
    <>
      <div className="profile-top">
        <button className="icon-btn boxed" onClick={() => nav(-1)} aria-label="Volver"><Icon name="back" /></button>
        <p className="eyebrow">{isMe ? "Tu perfil" : "Perfil"}</p>
        {isMe ? <button className="icon-btn boxed" onClick={() => setEditing(true)} aria-label="Editar perfil"><Icon name="edit" size={20} /></button> : <span style={{ width: 40 }} />}
      </div>

      <section className="console profile-card">
        <Avatar profile={p} size={96} />
        <h1 className="h1">{p.displayName}</h1>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          {plan ? `Ing. ${plan.carrera.nombreCorto}` : "Sin carrera elegida"}{lastSession ? ` · estudió ${relativeTime(lastSession.createdAt)}` : ""}
        </p>
        <div className="spec">
          <div><span className="num">{fmtHours(weekMinutes(ss, startOfWeek()))}</span><span className="eyebrow">h esta semana</span></div>
          <div><span className="num">{currentStreak(ss)}</span><span className="eyebrow">días seguidos</span></div>
          <div><span className="num">{fmtHours(totalMin, 0)}</span><span className="eyebrow">h en total</span></div>
        </div>
      </section>

      <div className="section-title">
        <h2 className="h2">Colección</h2>
        {isMe ? <Link to="/parque?tab=cat" className="link">Catálogo</Link> : <span className="eyebrow">{owned.length} de {CATALOG.length}</span>}
      </div>
      <div className="card coll-head">
        <span className="eyebrow">{owned.length} de {CATALOG.length} distintas</span>
        <div className="cat-progress"><b style={{ width: `${(owned.length / CATALOG.length) * 100}%` }} /></div>
        <span className="eyebrow">{scrap} chatarra</span>
      </div>
      {owned.length === 0 ? (
        <div className="card empty" style={{ marginTop: 8 }}>Todavía no fabricó ninguna pieza.</div>
      ) : (
        <div className="showroom" style={{ marginTop: 8 }}>
          {owned.slice(0, 9).map(({ d, n }) => (
            <button key={d.id} className={`r-${d.r}`} onClick={() => setPiece(d.id)}>
              <span className="cnt">×{n}</span>
              {n >= 3 && <span className="stars">{"★".repeat(starsOf(n))}</span>}
              <IsoPiece piece={d.id} size={92} height={80} />
              <span className="txt">
                <span className="nm">{d.n}</span>
                <span className="tr">{({ comun: "Común", rara: "Rara", epica: "Épica", legendaria: "Legendaria" } as Record<string, string>)[d.r]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {owned.length > 9 && <Link to="/parque?tab=cat" className="btn block" style={{ marginTop: 8 }}>Ver las {owned.length} piezas</Link>}

      <div className="section-title"><h2 className="h2">Trofeos</h2><span className="eyebrow">{earned} de {trophies.length}</span></div>
      <div className="trophy-bar"><b style={{ width: `${(earned / Math.max(1, trophies.length)) * 100}%` }} /></div>
      <div className="trophies">
        {sortedTrophies.map((t) => (
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
          <div className="stack" style={{ alignItems: "center", textAlign: "center", paddingBottom: 8 }}>
            <Medal glyph={trophy.glyph} earned={trophy.earned} size={110} />
            <p className="eyebrow">{trophy.earned ? "Conseguido" : "Bloqueado"}</p>
            <h2 className="h1" style={{ fontSize: "1.7rem" }}>{trophy.name}</h2>
            <p style={{ margin: 0, maxWidth: 320 }}>{trophy.description}</p>
            {!trophy.earned && trophy.progress && <p className="small muted" style={{ margin: 0 }}>{trophy.progress}</p>}
          </div>
        )}
      </Sheet>
      <PieceSheet piece={piece} count={piece ? counts.get(pieceDef(piece).id) ?? 0 : 0} owner={isMe ? "Vos" : p.displayName} onClose={() => setPiece(null)} />
    </>
  );
}
