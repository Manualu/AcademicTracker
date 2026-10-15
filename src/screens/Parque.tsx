import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { IsoPiece } from "../components/IsoPiece";
import { ParkCanvas, useParkWorld } from "../components/ParkCanvas";
import { PieceSheet } from "../components/PieceSheet";
import { Reveal } from "../components/Reveal";
import { Avatar, Icon } from "../components/ui";
import { makePainter } from "../iso/iso";
import {
  boundsFor, clearSelection, drawNave, emitParticles, formOf, getLight, LEVELS, levelOf, MAX_NAVES, NAVE_FORMS, setLight, setsDone,
  STAGE_FOCUS, STAGES, stageIdx, starsOf, type ParkScene, type ParkSelection,
} from "../iso/park";
import { CATALOG, inventoryOf, pieceDef, RARITY, RARITY_ORDER, RARITY_RANK, RECYCLE_COST, rollRecycled, SETS, TIERS, type Rarity } from "../lib/catalog";
import type { ParkWorld } from "../lib/park";
import { useStore } from "../lib/store";
import { fmtHours, fmtMinutes, uuid } from "../lib/time";
import type { PieceKey } from "../lib/types";

const PERSON_NAMES = ["Rosa, operaria del turno mañana", "Julián, de mantenimiento", "Caro, de seguridad e higiene", "Tito, autoelevadorista", "Mica, pasante de Industrial", "Don Oscar, el tornero", "Lu, de calidad", "Facu, de logística"];
const LIGHTS = ["auto", "dia", "atardecer", "noche"] as const;
const LIGHT_NAME = { auto: "Hora real", dia: "Día", atardecer: "Atardecer", noche: "Noche" };
const LIGHT_ICON = { auto: "clock", dia: "sun", atardecer: "sunset", noche: "moon" };
const fmtH = (h: number) => (h < 10 ? h.toFixed(1).replace(".", ",") : String(Math.round(h)));

// ---------------------------------------------------------------- Dibujo de la nave (para Mi nave)
const naveCache = new Map<string, string>();
function naveImg(f: { n: string; col: string }, form: number, w = 260, h = 200): string {
  const key = `${f.n}|${f.col}|${form}|${w}`;
  const hit = naveCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  const topZ = [1.1, 1.35, 1.45, 1.9, 2.4, 4.7][form];
  const tw = Math.min(w / 4.4, (h - 16) / (2 + topZ * 0.62));
  const P = makePainter(ctx, { ox: w / 2 - tw * 0.1, oy: h - 10 - (4 * tw) / 2 + tw * 0.1, tw });
  P.tile(0, 0, 4, 4, "#D6DCE2");
  for (let i = 0; i <= 4; i++) {
    ctx.strokeStyle = "rgba(20,33,61,.1)"; ctx.beginPath();
    ctx.moveTo(...P.S(i, 0)); ctx.lineTo(...P.S(i, 4)); ctx.moveTo(...P.S(0, i)); ctx.lineTo(...P.S(4, i)); ctx.stroke();
  }
  drawNave(P, { ...f, lot: [0, 0] }, form, false, 1);
  const url = c.toDataURL("image/png");
  naveCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------- Inspector
export function Inspector({ sel, world, onClose, onFicha }: { sel: ParkSelection; world: ParkWorld; onClose: () => void; onFicha: (id: string, owner: string) => void }) {
  const nav = useNavigate();
  let body: React.ReactNode = null;
  if ((sel.k === "nave" || sel.k === "racha" || sel.k === "cerrado") && sel.f) {
    const f = world.friends.find((x) => x.id === sel.f!.id) ?? sel.f;
    const lvl = levelOf(f.hours), form = formOf(lvl), next = LEVELS[lvl];
    const total = [...f.inv.values()].reduce((a, b) => a + b, 0);
    body = (
      <>
        <img className="insp-face" src={f.avatar} alt="" style={{ background: f.col, opacity: f.closed ? 0.6 : 1 }} />
        <div className="grow">
          <p className="eyebrow">Nave · nivel {lvl}</p>
          <h3 className="h2">{f.n}</h3>
          {f.live && (
            <p className="small live-line"><span className="dotlive" /> Estudiando <b>{f.live.subject}</b> hace {fmtMinutes(Math.max(0, Math.floor((Date.now() - f.live.startedAt) / 60000)))}</p>
          )}
          <p className="small" style={{ margin: "4px 0 0" }}><b>{LEVELS[lvl - 1].n}</b>, {fmtH(f.hours)} h desde el tratado</p>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            {NAVE_FORMS[form].n}. {total} piezas, {f.inv.size} distintas.{next ? ` Le faltan ${Math.ceil(next.h - f.hours)} h para el nivel ${lvl + 1}.` : ""}
          </p>
          {f.closed && <p className="small strong" style={{ margin: "4px 0 0", color: "var(--red)" }}>No estudió ni hoy ni ayer: la nave está apagada.</p>}
          {f.flag && !f.closed && <p className="small" style={{ margin: "4px 0 0" }}><b>Racha de 7 días o más</b> (por eso la bandera).</p>}
          <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => nav(`/perfil/${f.id}`)}>Ver perfil</button></div>
        </div>
      </>
    );
  } else if (sel.k === "pieza" && "p" in sel && sel.f) {
    const p = sel.p as { id: string; n: string; r: string };
    const n = sel.n as number;
    body = (
      <>
        <IsoPiece piece={p.id} size={70} height={60} />
        <div className="grow">
          <p className="eyebrow">De {sel.f.n} · tiene {n} {"★".repeat(starsOf(n))}</p>
          <h3 className="h2">{p.n}</h3>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <span className="rar" style={{ ["--rc" as string]: RARITY[p.r as Rarity].color }}>{RARITY[p.r as Rarity].n}</span>
            <button className="btn sm" onClick={() => onFicha(p.id, sel.f!.id)}>Ficha técnica</button>
          </div>
        </div>
      </>
    );
  } else if (sel.k === "persona") {
    body = <div className="grow"><p className="eyebrow">Gente del parque</p><h3 className="h2">{PERSON_NAMES[Math.floor(Math.random() * PERSON_NAMES.length)]}</h3><p className="small muted" style={{ margin: "4px 0 0" }}>Cuantas más etapas desbloquean, más gente trabaja acá.</p></div>;
  } else {
    const st = STAGES.find((s) => s.id === sel.k);
    const extra = sel.k === "museo" ? { n: "Museo de la Ingeniería", d: "Aparece cuando alguien junta las seis reliquias legendarias." }
      : sel.k === "proxima" ? { n: "Próxima ampliación", d: `El terreno crece cuando el grupo llega a ${STAGES.find((s) => s.h > world.groupHours)?.h ?? "—"} h.` } : null;
    const info = st ?? extra;
    if (!info) return null;
    body = <div className="grow"><p className="eyebrow">{st ? `Etapa ${STAGES.indexOf(st) + 1} · ${st.h} h del grupo` : "Parque"}</p><h3 className="h2">{info.n}</h3><p className="small muted" style={{ margin: "4px 0 0" }}>{info.d}</p></div>;
  }
  return (
    <div className="park-inspector">
      {body}
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={18} /></button>
    </div>
  );
}

// ---------------------------------------------------------------- Pestañas
function MiNave({ world, onFocus, onFicha }: { world: ParkWorld; onFocus: () => void; onFicha: (id: string) => void }) {
  const { data, userId, dispatch } = useStore();
  const me = world.friends.find((f) => f.id === userId);
  const [reveal, setReveal] = useState<PieceKey | null>(null);
  if (!me) return null;
  const idx = world.friends.findIndex((f) => f.id === userId);
  const lvl = levelOf(me.hours), form = formOf(lvl), cur = LEVELS[lvl - 1], next = LEVELS[lvl];
  const total = [...me.inv.values()].reduce((a, b) => a + b, 0);
  const distinct = [...me.inv.keys()].filter((k) => k !== "chatarra").length;
  const relics = CATALOG.filter((p) => p.r === "legendaria" && me.inv.has(p.id)).length;
  const scrap = me.inv.get("chatarra") ?? 0;
  const done = setsDone(me);

  function recycle() {
    if (!userId || scrap < RECYCLE_COST) return;
    const id = uuid();
    const piece = rollRecycled(id);
    dispatch({ kind: "recycle.add", recycle: { id, userId, piece, createdAt: new Date().toISOString() } });
    setReveal(piece);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {idx >= MAX_NAVES && (
        <div className="callout small">El parque tiene lugar para {MAX_NAVES} naves y ya están ocupadas. Tus piezas y tu nivel cuentan igual.</div>
      )}
      <section className="console">
        <div className="row" style={{ gap: 14 }}>
          <div className="lvl-badge"><span className="display">{lvl}</span></div>
          <div className="grow">
            <p className="eyebrow">Tu nivel · {fmtH(me.hours)} h desde el tratado</p>
            <h2 className="h1" style={{ color: "#fff", fontSize: "1.5rem", marginTop: 6 }}>{cur.n}</h2>
          </div>
        </div>
        {next ? (
          <div style={{ marginTop: 14 }}>
            <div className="con-bar"><b style={{ width: `${((me.hours - cur.h) / (next.h - cur.h)) * 100}%` }} /></div>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Faltan {Math.ceil(next.h - me.hours)} h para <b style={{ color: "#fff" }}>{next.n}</b> (nivel {lvl + 1})</p>
          </div>
        ) : <p className="small" style={{ marginTop: 12 }}><b>Nivel máximo.</b> Leyenda absoluta.</p>}
        <div className="nave-pair">
          <figure><img src={naveImg(me, form)} alt={`Tu nave: ${NAVE_FORMS[form].n}`} /><figcaption>Ahora · {NAVE_FORMS[form].n}</figcaption></figure>
          {form < NAVE_FORMS.length - 1 && (
            <figure className="next"><img src={naveImg(me, form + 1)} alt={`Tu nave en el nivel ${NAVE_FORMS[form + 1].from}`} /><figcaption>Nivel {NAVE_FORMS[form + 1].from} · {NAVE_FORMS[form + 1].n}</figcaption></figure>
          )}
        </div>
        <div className="forms">{NAVE_FORMS.map((F, i) => <div key={i} className={i <= form ? "on" : ""}>Nv {F.from}</div>)}</div>
        <div className="career-stats">
          <div><span className="num">{total}</span><div className="eyebrow">piezas</div></div>
          <div><span className="num">{distinct}<small className="faint">/{CATALOG.length}</small></span><div className="eyebrow">distintas</div></div>
          <div><span className="num">{relics}<small className="faint">/6</small></span><div className="eyebrow">reliquias</div></div>
        </div>
        <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
          {idx < MAX_NAVES && <button className="btn sm" onClick={onFocus}><Icon name="factory" size={16} />Ver mi nave en el parque</button>}
          {scrap >= RECYCLE_COST
            ? <button className="btn sm primary" onClick={recycle}><Icon name="sync" size={16} />Reciclar {RECYCLE_COST} chatarras</button>
            : <span className="tiny muted">Chatarra: {scrap}. Con {RECYCLE_COST} la reciclás en una pieza común.</span>}
        </div>
      </section>

      <div className="section-title" style={{ marginTop: 10 }}><h2 className="h2">Colecciones</h2><span className="eyebrow">{done.length} de {SETS.length}</span></div>
      <div className="stack" style={{ gap: 10 }}>
        {SETS.map((s) => {
          const got = s.ids.filter((id) => me.inv.has(id)).length;
          const complete = got === s.ids.length;
          return (
            <div key={s.id} className={`card set ${complete ? "complete" : ""}`}>
              <div className="row between"><b>{s.n}</b><span className={`eyebrow ${complete ? "ok" : ""}`}>{complete ? "Completa" : `${got} de ${s.ids.length}`}</span></div>
              <div className="set-items">
                {s.ids.map((id) => (
                  <button key={id} className={me.inv.has(id) ? "" : "off"} onClick={() => onFicha(id)} aria-label={`${pieceDef(id).n}${me.inv.has(id) ? "" : " (falta)"}`}>
                    <IsoPiece piece={id} size={52} height={46} locked={!me.inv.has(id)} />
                  </button>
                ))}
              </div>
              <span className="tiny muted">Premio: {s.premio}</span>
            </div>
          );
        })}
      </div>
      {reveal && (
        <Reveal piece={reveal} count={inventoryOf(data, userId!).get(reveal) ?? 1}>
          {(shown) => shown && (
            <>
              <span className="rar big" style={{ ["--rc" as string]: RARITY[pieceDef(reveal).r as Rarity].color }}>{RARITY[pieceDef(reveal).r as Rarity].n}</span>
              <h2 className="h1">{pieceDef(reveal).n}</h2>
              <p className="small">Reciclaste {RECYCLE_COST} chatarras.</p>
              <button className="btn primary" onClick={() => setReveal(null)}>Guardar en mi nave</button>
            </>
          )}
        </Reveal>
      )}
    </div>
  );
}

function Catalogo({ onFicha }: { onFicha: (id: string, owner: string) => void }) {
  const { data, userId } = useStore();
  const [who, setWho] = useState(userId!);
  const [rar, setRar] = useState<Rarity | "todas">("todas");
  const [only, setOnly] = useState(false);
  const inv = useMemo(() => inventoryOf(data, who), [data, who]);
  const person = data.profiles.find((p) => p.id === who);
  const list = CATALOG.filter((p) => (rar === "todas" || p.r === rar) && (!only || inv.has(p.id)));
  const got = CATALOG.filter((p) => inv.has(p.id)).length;
  return (
    <div>
      {data.profiles.length > 1 && (
        <div className="friend-switch" role="group" aria-label="Colección de">
          {[...data.profiles].sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0)).map((p) => (
            <button key={p.id} className="chip" aria-pressed={who === p.id} onClick={() => setWho(p.id)}><Avatar profile={p} size={28} />{p.id === userId ? "Yo" : p.displayName}</button>
          ))}
        </div>
      )}
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="eyebrow">{person?.id === userId ? "Tenés" : `${person?.displayName} tiene`} {got} de {CATALOG.length}</span>
        <div className="cat-progress"><b style={{ width: `${(got / CATALOG.length) * 100}%` }} /></div>
      </div>
      <div className="chips" role="group" aria-label="Filtrar por rareza" style={{ marginBottom: 6 }}>
        <button className="chip" aria-pressed={rar === "todas"} onClick={() => setRar("todas")}>Todas</button>
        {RARITY_ORDER.map((k) => <button key={k} className="chip" aria-pressed={rar === k} onClick={() => setRar(k)}><span className="rdot" style={{ background: RARITY[k].color }} />{RARITY[k].n}s</button>)}
        <button className="chip" aria-pressed={only} onClick={() => setOnly(!only)}>Solo las que tiene</button>
      </div>
      {TIERS.map((t) => {
        const items = list.filter((p) => p.tier === t.t).sort((a, b) => RARITY_RANK[a.r] - RARITY_RANK[b.r]);
        if (!items.length) return null;
        return (
          <section key={t.t}>
            <div className="sec-head"><h2 className="h2">{t.t}. {t.name}</h2><span className="count">{t.label}</span></div>
            <div className="catalog">
              {items.map((p) => {
                const n = inv.get(p.id) ?? 0;
                return (
                  <button key={p.id} className={`piece-card r-${p.r} ${n ? "" : "locked"}`} onClick={() => onFicha(p.id, who)}
                    aria-label={`${p.n}, ${RARITY[p.r as Rarity].n}${n ? `, tiene ${n}` : ", sin conseguir"}`}>
                    {n > 0 && <span className="stars">{"★".repeat(starsOf(n))}</span>}
                    {n > 0 && <span className="cnt">×{n}</span>}
                    <IsoPiece piece={p.id} size={120} height={92} locked={!n} />
                    <span className="nm">{p.n}</span>
                    <span className="rar" style={{ ["--rc" as string]: RARITY[p.r as Rarity].color }}>{RARITY[p.r as Rarity].n}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="small muted" style={{ marginTop: 16 }}>Las repetidas suben de nivel: con 3 copias la pieza gana ★★ y una placa; con 6, ★★★ y brillo dorado en el parque.</p>
    </div>
  );
}

function Etapas({ world, onStage }: { world: ParkWorld; onStage: (id: string) => void }) {
  const { userId } = useStore();
  const H = world.groupHours, cur = stageIdx(H);
  const me = world.friends.find((f) => f.id === userId);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="small muted" style={{ margin: 0 }}>Se desbloquean con las horas de todo el grupo desde la firma del tratado.</p>
      <ol className="timeline card tight">
        {STAGES.map((s, i) => (
          <li key={s.id} className={i <= cur ? "done" : i === cur + 1 ? "next" : ""}>
            <span className="idx">{i <= cur ? <Icon name="check" size={15} stroke={3} /> : i + 1}</span>
            <span className="grow">
              <b>{s.n}</b>
              <span className="small muted">{s.d}</span>
              {i === cur + 1 && <span className="small strong" style={{ display: "block", marginTop: 4 }}>Faltan {Math.ceil(s.h - H)} h</span>}
              {i <= cur && STAGE_FOCUS[s.id] && <button className="link-btn" onClick={() => onStage(s.id)}>Ver en el parque →</button>}
            </span>
            <span className="h">{s.h} h</span>
          </li>
        ))}
      </ol>
      <div className="section-title"><h2 className="h2">Niveles de cada uno</h2></div>
      <p className="small muted" style={{ margin: "-6px 0 0" }}>Con tus propias horas. La nave cambia de forma en los niveles 1, 3, 5, 7, 9 y 11.</p>
      <ol className="timeline card tight">
        {LEVELS.map((L, i) => (
          <li key={L.h} className={me && me.hours >= L.h ? "done" : ""}>
            <span className="idx">{i + 1}</span><span className="grow"><b>{L.n}</b></span><span className="h">{L.h} h</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- Pantalla
export default function Parque() {
  const world = useParkWorld();
  const { data, userId } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "nave" | "cat" | "etapas") || "nave";
  const scene = useRef<ParkScene | null>(null);
  const [sel, setSel] = useState<ParkSelection | null>(null);
  const [ficha, setFicha] = useState<{ id: string; owner: string } | null>(null);
  const [light, setL] = useState(getLight());
  const [lightTag, setLightTag] = useState(false);
  const tagTimer = useRef<number | undefined>(undefined);
  const H = world.groupHours, i = stageIdx(H), st = STAGES[i], next = STAGES[i + 1];

  useEffect(() => () => clearSelection(), []);
  useEffect(() => { scene.current?.redraw(); }, [world]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __park?: unknown }).__park = scene.current; });

  const focusStage = (id: string) => {
    const f = STAGE_FOCUS[id];
    if (!f) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    scene.current?.focus(f[0], f[1], f[2]);
    setSel({ k: id });
  };
  const focusMe = () => {
    const idx = world.friends.findIndex((f) => f.id === userId);
    if (idx < 0 || idx >= 4) return;
    const lots = [[5, 5], [11, 5], [5, 11], [11, 11]];
    window.scrollTo({ top: 0, behavior: "smooth" });
    scene.current?.focus(lots[idx][0] + 2, lots[idx][1] + 2, 2.2);
  };
  const ownerName = (id: string) => (id === userId ? "Vos" : data.profiles.find((p) => p.id === id)?.displayName ?? "");
  const [lo, hi] = boundsFor(H);

  return (
    <>
      <section className="park-stage">
        <ParkCanvas sceneRef={scene} onSelect={setSel} label="Parque industrial del grupo. Arrastrá, hacé zoom y tocá cada cosa." />
        <div className="park-hud">
          <Link to="/" className="icon-btn boxed" aria-label="Volver al inicio"><Icon name="back" /></Link>
          <div className="park-pill grow">
            <p className="eyebrow">Etapa {i + 1} de {STAGES.length} · {hi - lo} × {hi - lo}</p>
            <div className="row" style={{ gap: 8, alignItems: "baseline", marginTop: 4 }}>
              <span className="num" style={{ fontSize: "1.35rem" }}>{Math.round(H)} h</span>
              <span className="small strong ellipsis">{st.n}</span>
            </div>
            <div className="mini-bar"><b style={{ width: next ? `${((H - st.h) / (next.h - st.h)) * 100}%` : "100%" }} /></div>
            <p className="tiny muted" style={{ margin: "4px 0 0" }}>{next ? `Faltan ${Math.ceil(next.h - H)} h para: ${next.n}` : "Parque completo. Todo lo que sumen ahora es gloria."}</p>
          </div>
          <div className="park-tools">
            <button className="icon-btn boxed" onClick={() => scene.current?.zoomBy(1.35)} aria-label="Acercar"><Icon name="plus" size={20} /></button>
            <button className="icon-btn boxed" onClick={() => scene.current?.zoomBy(1 / 1.35)} aria-label="Alejar"><Icon name="minus" size={20} /></button>
            <button className="icon-btn boxed" onClick={() => scene.current?.recenter()} aria-label="Ver todo el parque"><Icon name="fit" size={20} /></button>
            <button className="icon-btn boxed light-btn" aria-label={`Luz: ${LIGHT_NAME[light]}. Tocá para cambiar`} onClick={() => {
              const n = LIGHTS[(LIGHTS.indexOf(light) + 1) % LIGHTS.length];
              setLight(n); setL(n); scene.current?.redraw();
              setLightTag(true); window.clearTimeout(tagTimer.current); tagTimer.current = window.setTimeout(() => setLightTag(false), 1600);
            }}><Icon name={LIGHT_ICON[light]} size={20} />{lightTag && <span className="light-tag">{LIGHT_NAME[light]}</span>}</button>
          </div>
        </div>
        {sel && <Inspector sel={sel} world={world} onClose={() => { setSel(null); clearSelection(); scene.current?.redraw(); }} onFicha={(id, owner) => setFicha({ id, owner })} />}
      </section>

      <div className="seg park-tabs" role="tablist" aria-label="Secciones del parque">
        {([["nave", "Mi nave"], ["cat", "Catálogo"], ["etapas", "Etapas"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setParams({ tab: k }, { replace: true })}>{l}</button>
        ))}
      </div>

      {tab === "nave" && <MiNave world={world} onFocus={focusMe} onFicha={(id) => setFicha({ id, owner: userId! })} />}
      {tab === "cat" && <Catalogo onFicha={(id, owner) => setFicha({ id, owner })} />}
      {tab === "etapas" && <Etapas world={world} onStage={focusStage} />}

      <PieceSheet piece={ficha?.id ?? null} count={ficha ? inventoryOf(data, ficha.owner).get(ficha.id) ?? 0 : 0}
        owner={ficha ? ownerName(ficha.owner) : ""} onClose={() => setFicha(null)} />
    </>
  );
}

/** Avisa (una vez) cuando el grupo desbloquea una etapa nueva o subís de nivel. */
export function useParkMilestones(world: ParkWorld) {
  const { toast, userId } = useStore();
  useEffect(() => {
    const me = world.friends.find((f) => f.id === userId);
    if (!me) return; // todavía no llegaron los datos: no comparar contra un parque vacío
    const now = { st: stageIdx(world.groupHours), lvl: levelOf(me.hours) };
    let prev: { st: number; lvl: number } | null = null;
    try { prev = JSON.parse(localStorage.getItem("remontada.parque.visto") ?? "null"); } catch { /* sin almacenamiento */ }
    try { localStorage.setItem("remontada.parque.visto", JSON.stringify(now)); } catch { /* ignorar */ }
    if (!prev) return;
    if (now.st > prev.st) {
      const s = STAGES[now.st];
      toast({ title: `Nueva etapa del parque: ${s.n}`, body: s.d, icon: "factory" });
      const f = STAGE_FOCUS[s.id];
      if (f) for (let k = 0; k < 24; k++) emitParticles(f[0] + (Math.random() - 0.5) * 2, f[1] + (Math.random() - 0.5) * 2, 0.1, "polvo");
    }
    if (now.lvl > prev.lvl) {
      const form = formOf(now.lvl);
      toast({ title: `Subiste al nivel ${now.lvl}: ${LEVELS[now.lvl - 1].n}`, body: NAVE_FORMS[form].from === now.lvl ? `Tu nave ahora es: ${NAVE_FORMS[form].n}.` : "Seguí así.", icon: "star" });
    }
  }, [world.groupHours, world.friends, userId, toast]);
}
