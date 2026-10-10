import { useMemo, useState } from "react";
import { Avatar, Icon, ScreenHead, Sheet } from "../components/ui";
import {
  CARRERAS, correlativaOk, creditosAprobados, creditosCarrera, creditosParaRequisito, findPlan, habilitaA, habilitada, isCbc, materiaNombre, planLabel,
  sections, statusMap, usePlan, type Materia, type StatusMap,
} from "../lib/planes";
import { useStore } from "../lib/store";
import type { Profile, SubjectState } from "../lib/types";

const STATES: { key: SubjectState | null; label: string; hint: string; color: string }[] = [
  { key: null, label: "Pendiente", hint: "Todavía no la cursaste", color: "var(--surface-3)" },
  { key: "cursando", label: "Cursando", hint: "Este cuatrimestre", color: "var(--yellow)" },
  { key: "regularizada", label: "Regularizada", hint: "Cursada aprobada, falta el final", color: "var(--blue)" },
  { key: "aprobada", label: "Aprobada", hint: "Final aprobado", color: "var(--green)" },
];

function PlanPicker({ onPick, onCancel }: { onPick: (planId: string) => void; onCancel?: () => void }) {
  const [carrera, setCarrera] = useState<string | null>(null);
  const c = CARRERAS.find((x) => x.nombre === carrera);
  return (
    <div className="stack">
      {!c ? (
        <>
          <h2 className="h2">¿Qué carrera seguís?</h2>
          <div className="plan-list">
            {CARRERAS.map((x) => <button key={x.nombre} onClick={() => (x.planes.length === 1 ? onPick(x.planes[0].id) : setCarrera(x.nombre))}>{x.nombre}</button>)}
          </div>
        </>
      ) : (
        <>
          <button className="link btn-ghost" style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, color: "var(--ink-2)", fontWeight: 600 }} onClick={() => setCarrera(null)}>← Otra carrera</button>
          <h2 className="h2">{c.nombre}: ¿qué plan?</h2>
          <div className="plan-list">
            {[...c.planes].sort((a, b) => b.ano - a.ano).map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)}>
                <span>{planLabel(p)}<div className="eyebrow" style={{ marginTop: 4 }}>{creditosCarrera(p)} créditos sin el CBC</div></span>
              </button>
            ))}
          </div>
        </>
      )}
      {onCancel && <button className="btn block" onClick={onCancel}>Cancelar</button>}
      <p className="tiny faint">Planes tomados de FIUBA-Map (fede.dm/FIUBA-Map), que digitaliza los planes oficiales de la facultad.</p>
    </div>
  );
}

function SubjectCard({ m, st, materias, onOpen }: { m: Materia; st: StatusMap; materias: Materia[]; onOpen: () => void }) {
  const s = st.get(m.id);
  const ok = habilitada(m, materias, st);
  const cls = s ?? (ok ? "avail" : "locked");
  return (
    <button className={`subj ${cls}`} onClick={onOpen}>
      <span className="n">{m.nombre}</span>
      <span className="meta">
        <span>{m.creditos} cr</span>
        {s ? <span className="st">{s === "aprobada" && <Icon name="check" size={11} stroke={3} />}{STATES.find((x) => x.key === s)!.label}</span>
          : ok ? <span style={{ color: "var(--ink-2)" }}>Disponible</span> : <Icon name="lock" size={13} />}
      </span>
    </button>
  );
}

function SubjectSheet({ m, materias, st, editable, onSet, onClose }: {
  m: Materia | null; materias: Materia[]; st: StatusMap; editable: boolean;
  onSet: (m: Materia, s: SubjectState | null) => void; onClose: () => void;
}) {
  if (!m) return null;
  const current = st.get(m.id) ?? null;
  const unlocks = habilitaA(m, materias);
  return (
    <Sheet open onClose={onClose} label={m.nombre} title={m.nombre} eyebrow={`${m.categoria.replace("*CBC", "CBC")} · ${m.creditos} créditos`}>
      <div className="stack" style={{ gap: 18 }}>
        {editable ? (
          <div className="state-buttons" role="group" aria-label="Estado">
            {STATES.map((s) => (
              <button key={s.label} aria-pressed={current === s.key} onClick={() => { onSet(m, s.key); onClose(); }}>
                <span className="sw" style={{ background: s.color }} />
                {s.label}<span className="tiny muted" style={{ fontWeight: 400 }}>{s.hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="card row"><span className="sw" style={{ width: 14, height: 14, borderRadius: 4, background: STATES.find((s) => s.key === current)!.color }} /><b>{STATES.find((s) => s.key === current)!.label}</b></div>
        )}
        {(m.correlativas.length > 0 || m.requiereCreditos) && (
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Correlativas</p>
            <ul className="req-list">
              {m.correlativas.map((c) => {
                const ok = correlativaOk(c, materias, st);
                return <li key={c}>{ok ? <span className="ok"><Icon name="check" size={13} stroke={3} /></span> : <span className="no" />}<span className={ok ? "" : "muted"}>{materiaNombre(materias, c)}</span></li>;
              })}
              {m.requiereCreditos && (() => {
                const have = creditosParaRequisito(m, materias, st);
                const ok = have >= m.requiereCreditos;
                return (
                  <li>{ok ? <span className="ok"><Icon name="check" size={13} stroke={3} /></span> : <span className="no" />}
                    <span className={ok ? "" : "muted"}>{m.requiereCreditos} créditos aprobados{m.requiereCbc ? ", con el CBC" : ", sin el CBC"} <span className="faint">(tenés {have})</span></span>
                  </li>
                );
              })()}
            </ul>
          </div>
        )}
        {unlocks.length > 0 && (
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Habilita · {unlocks.length}</p>
            <div className="chips">{unlocks.map((u) => <span key={u.id} className="chip" style={{ cursor: "default", fontSize: ".8rem", padding: "5px 11px" }}>{u.nombre}</span>)}</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CareerGauge({ aprob, reg, total }: { aprob: number; reg: number; total: number }) {
  const size = 112, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const a = total ? aprob / total : 0, b = total ? reg / total : 0;
  return (
    <div className="gaugeR">
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(220,232,255,.1)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#7eaeff" strokeWidth={stroke} strokeDasharray={`${c * (a + b)} ${c}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3fd09a" strokeWidth={stroke} strokeDasharray={`${c * a} ${c}`} />
      </svg>
      <div className="c"><div><span className="display">{Math.round(a * 100)}<span style={{ fontSize: "1.1rem" }}>%</span></span><div className="eyebrow" style={{ marginTop: 4 }}>aprobado</div></div></div>
    </div>
  );
}

export default function Carrera() {
  const { data, userId, dispatch } = useStore();
  const [viewId, setViewId] = useState<string>(userId!);
  const [changing, setChanging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const viewed: Profile | undefined = data.profiles.find((p) => p.id === viewId);
  const editable = viewId === userId;
  const planId = viewed?.planId ?? null;
  const found = findPlan(planId);
  const materias = usePlan(planId);
  const st = useMemo(() => (planId ? statusMap(data.statuses, viewId, planId) : new Map()), [data.statuses, viewId, planId]);

  const setStatus = (m: Materia, s: SubjectState | null) => {
    if (!planId || !userId) return;
    dispatch({ kind: "status.set", userId, planId, subjectId: m.id, subjectName: m.nombre, status: s, at: new Date().toISOString() });
  };

  const friends = data.profiles.length > 1 && (
    <div className="friend-switch" role="group" aria-label="Ver la carrera de">
      {[...data.profiles].sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0)).map((p) => (
        <button key={p.id} className="chip" aria-pressed={viewId === p.id} onClick={() => setViewId(p.id)}>
          <Avatar profile={p} size={28} />{p.id === userId ? "Yo" : p.displayName}
        </button>
      ))}
    </div>
  );

  if (editable && (!planId || changing)) {
    return (
      <>
        <ScreenHead eyebrow="Plan de estudios" title="Carrera" sub="Elegí tu carrera y plan para ir marcando las materias." />
        {friends}
        <PlanPicker onPick={(id) => { dispatch({ kind: "profile.update", userId: userId!, patch: { planId: id } }); setChanging(false); }}
          onCancel={planId ? () => setChanging(false) : undefined} />
      </>
    );
  }

  const header = (
    <ScreenHead eyebrow={found ? `${found.carrera.nombre} · ${planLabel(found.plan)}` : "Plan de estudios"} title={editable ? "Carrera" : `Carrera de ${viewed?.displayName}`}
      right={editable && found ? <button className="btn sm" onClick={() => setChanging(true)}>Cambiar</button> : undefined} />
  );

  if (!found) {
    return (<>{header}{friends}<div className="card empty">{viewed?.displayName} todavía no eligió su carrera.</div></>);
  }
  if (!materias) return (<>{header}{friends}</>);

  const noCbc = materias.filter((m) => !isCbc(m));
  const aprob = creditosAprobados(materias, st);
  const reg = noCbc.filter((m) => st.get(m.id) === "regularizada").reduce((a, m) => a + m.creditos, 0);
  const total = creditosCarrera(found.plan) || noCbc.reduce((a, m) => a + m.creditos, 0);
  const count = (s: SubjectState) => noCbc.filter((m) => st.get(m.id) === s).length;
  const cbc = materias.filter(isCbc);
  const open = materias.find((m) => m.id === openId) ?? null;
  const disponibles = noCbc.filter((m) => !st.get(m.id) && habilitada(m, materias, st)).length;

  return (
    <>
      {header}
      {friends}
      <section className="console">
        <div className="career-hero">
          <CareerGauge aprob={aprob} reg={reg} total={total} />
          <div>
            <p className="eyebrow">Créditos sin el CBC</p>
            <div style={{ marginTop: 6 }}><span className="display" style={{ fontSize: "2.6rem", color: "#fff" }}>{aprob}</span><span className="muted" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "1.2rem" }}> / {total}</span></div>
            <p className="small muted" style={{ margin: "6px 0 0" }}>{reg > 0 ? `+${reg} regularizados esperando final.` : "Sin finales pendientes."} {disponibles} {disponibles === 1 ? "materia disponible" : "materias disponibles"} para cursar.</p>
          </div>
        </div>
        <div className="career-stats">
          <div><span className="num">{count("aprobada")}</span><div className="eyebrow"><i style={{ background: "#3fd09a" }} />aprobadas</div></div>
          <div><span className="num">{count("regularizada")}</span><div className="eyebrow"><i style={{ background: "#7eaeff" }} />regulares</div></div>
          <div><span className="num">{count("cursando")}</span><div className="eyebrow"><i style={{ background: "var(--yellow)" }} />cursando</div></div>
        </div>
      </section>

      {sections(materias).map((sec) => {
        const tot = sec.materias.length;
        const ap = sec.materias.filter((m) => st.get(m.id) === "aprobada");
        const rg = sec.materias.filter((m) => st.get(m.id) === "regularizada");
        const done = ap.length === tot;
        const isOpen = !done || expanded.has(sec.key);
        const cr = sec.materias.reduce((a, m) => a + m.creditos, 0) || 1;
        return (
          <section key={sec.key}>
            <div className="sec-head">
              <h2 className="h2">{sec.title}{done && <span className="me-tag" style={{ background: "var(--green)", color: "#fff", marginLeft: 0 }}>completo</span>}</h2>
              <div className="row" style={{ gap: 6 }}>
                <span className="count">{ap.length}/{tot}</span>
                {done && (
                  <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label={isOpen ? "Ocultar" : "Mostrar"}
                    onClick={() => { const n = new Set(expanded); if (n.has(sec.key)) n.delete(sec.key); else n.add(sec.key); setExpanded(n); }}>
                    <span style={{ display: "inline-flex", transform: isOpen ? "rotate(180deg)" : undefined }}><Icon name="down" size={18} /></span>
                  </button>
                )}
              </div>
            </div>
            <div className="sec-bar" aria-hidden>
              <b style={{ width: `${(ap.reduce((a, m) => a + m.creditos, 0) / cr) * 100}%` }} />
              <b className="reg" style={{ width: `${(rg.reduce((a, m) => a + m.creditos, 0) / cr) * 100}%` }} />
            </div>
            {sec.key === "cbc" && editable && !done && (
              <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => cbc.forEach((m) => setStatus(m, "aprobada"))}><Icon name="check" size={16} />Marcar CBC completo</button>
            )}
            {isOpen && (
              <div className="subjects">
                {sec.materias.map((m) => <SubjectCard key={m.id} m={m} st={st} materias={materias} onOpen={() => setOpenId(m.id)} />)}
              </div>
            )}
          </section>
        );
      })}

      <SubjectSheet m={open} materias={materias} st={st} editable={editable} onSet={setStatus} onClose={() => setOpenId(null)} />
    </>
  );
}
