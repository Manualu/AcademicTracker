import { useMemo, useState } from "react";
import { Avatar, Icon, ScreenHead, Sheet } from "../components/ui";
import {
  CARRERAS, correlativaOk, creditosAprobados, creditosCarrera, creditosParaRequisito, findPlan, habilitaA, habilitada, isCbc, materiaNombre, planLabel,
  sections, statusMap, usePlan, type Materia, type StatusMap,
} from "../lib/planes";
import { useStore } from "../lib/store";
import type { Profile, SubjectState } from "../lib/types";

const STATES: { key: SubjectState | null; label: string; hint: string }[] = [
  { key: null, label: "Pendiente", hint: "Todavía no la cursaste" },
  { key: "cursando", label: "Cursando", hint: "Este cuatrimestre" },
  { key: "regularizada", label: "Regularizada", hint: "Cursada aprobada, falta el final" },
  { key: "aprobada", label: "Aprobada", hint: "Final aprobado" },
];

function PlanPicker({ onPick, onCancel }: { onPick: (planId: string) => void; onCancel?: () => void }) {
  const [carrera, setCarrera] = useState<string | null>(null);
  const c = CARRERAS.find((x) => x.nombre === carrera);
  return (
    <div className="stack">
      {!c ? (
        <>
          <h2 className="h2">¿Qué carrera seguís?</h2>
          <div className="subject-pick">
            {CARRERAS.map((x) => <button key={x.nombre} onClick={() => (x.planes.length === 1 ? onPick(x.planes[0].id) : setCarrera(x.nombre))}>{x.nombre}</button>)}
          </div>
        </>
      ) : (
        <>
          <h2 className="h2">{c.nombre}: ¿qué plan?</h2>
          <div className="subject-pick">
            {[...c.planes].sort((a, b) => b.ano - a.ano).map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)}>
                {planLabel(p)}<div className="small muted" style={{ fontWeight: 400 }}>{creditosCarrera(p)} créditos, sin contar el CBC</div>
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setCarrera(null)}>Elegir otra carrera</button>
        </>
      )}
      {onCancel && <button className="btn block" onClick={onCancel}>Cancelar</button>}
      <p className="tiny muted">Planes tomados de FIUBA-Map (fede.dm/FIUBA-Map), que digitaliza los planes oficiales de la facultad.</p>
    </div>
  );
}

function SubjectCard({ m, st, materias, onOpen }: { m: Materia; st: StatusMap; materias: Materia[]; onOpen: () => void }) {
  const s = st.get(m.id);
  const ok = habilitada(m, materias, st);
  const cls = s ?? (ok ? "" : "locked");
  return (
    <button className={`subj ${cls}`} onClick={onOpen}>
      <span className="n">{m.nombre}</span>
      <span className="meta">
        <span>{m.creditos} créd.</span>
        <span>{s ? STATES.find((x) => x.key === s)!.label : ok ? "" : <Icon name="lock" size={14} />}</span>
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
    <Sheet open onClose={onClose} label={m.nombre}>
      <div className="stack">
        <div>
          <div className="small muted">{m.categoria.replace("*CBC", "CBC")}, {m.creditos} créditos</div>
          <h2 className="h1" style={{ fontSize: "1.6rem" }}>{m.nombre}</h2>
        </div>
        {editable ? (
          <div className="state-buttons" role="group" aria-label="Estado">
            {STATES.map((s) => (
              <button key={s.label} aria-pressed={current === s.key} onClick={() => { onSet(m, s.key); onClose(); }}>
                {s.label}<div className="tiny" style={{ fontWeight: 400, opacity: 0.8 }}>{s.hint}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="card"><b>{STATES.find((s) => s.key === current)!.label}</b></div>
        )}
        {(m.correlativas.length > 0 || m.requiereCreditos) && (
          <div>
            <h3 className="h2" style={{ fontSize: "1.05rem", marginBottom: 6 }}>Correlativas</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {m.correlativas.map((c) => (
                <li key={c}>{materiaNombre(materias, c)} {correlativaOk(c, materias, st) ? "✓" : <span className="muted">(pendiente)</span>}</li>
              ))}
              {m.requiereCreditos && <li>{m.requiereCreditos} créditos aprobados{m.requiereCbc ? ", contando el CBC" : ", sin contar el CBC"} (tenés {creditosParaRequisito(m, materias, st)})</li>}
            </ul>
          </div>
        )}
        {unlocks.length > 0 && (
          <div>
            <h3 className="h2" style={{ fontSize: "1.05rem", marginBottom: 6 }}>Es correlativa de</h3>
            <p className="small" style={{ margin: 0 }}>{unlocks.map((u) => u.nombre).join(", ")}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default function Carrera() {
  const { data, userId, dispatch } = useStore();
  const [viewId, setViewId] = useState<string>(userId!);
  const [changing, setChanging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
    <div className="row" style={{ gap: 6, marginBottom: 14, overflowX: "auto" }} role="group" aria-label="Ver la carrera de">
      {data.profiles.map((p) => (
        <button key={p.id} className="chip row" style={{ gap: 6, padding: "4px 12px 4px 4px" }} aria-pressed={viewId === p.id} onClick={() => setViewId(p.id)}>
          <Avatar profile={p} size={26} />{p.id === userId ? "Yo" : p.displayName}
        </button>
      ))}
    </div>
  );

  if (editable && (!planId || changing)) {
    return (
      <>
        <ScreenHead title="Carrera" sub="Elegí tu carrera y plan para ir marcando las materias." />
        {friends}
        <PlanPicker onPick={(id) => { dispatch({ kind: "profile.update", userId: userId!, patch: { planId: id } }); setChanging(false); }}
          onCancel={planId ? () => setChanging(false) : undefined} />
      </>
    );
  }

  const header = (
    <ScreenHead title="Carrera" sub={found ? `${found.carrera.nombre}, ${planLabel(found.plan)}` : undefined}
      right={editable && found ? <button className="btn-ghost small" onClick={() => setChanging(true)}>Cambiar</button> : undefined} />
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
  const cbcDone = cbc.every((m) => st.get(m.id) === "aprobada");
  const open = materias.find((m) => m.id === openId) ?? null;

  return (
    <>
      {header}
      {friends}
      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
          <span className="num" style={{ fontSize: "2.3rem", lineHeight: 1 }}>{Math.round((aprob / total) * 100)}%</span>
          <span className="muted">{aprob} de {total} créditos aprobados, sin el CBC</span>
        </div>
        <div className="progress" aria-hidden>
          <b style={{ width: `${(aprob / total) * 100}%` }} />
          <b className="reg" style={{ width: `${(reg / total) * 100}%` }} />
        </div>
        <div className="stat-grid">
          <div><div className="num">{count("aprobada")}</div><div className="tiny muted">aprobadas</div></div>
          <div><div className="num">{count("regularizada")}</div><div className="tiny muted">regularizadas</div></div>
          <div><div className="num">{count("cursando")}</div><div className="tiny muted">cursando</div></div>
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--green)" }} />Aprobada</span>
          <span><i style={{ background: "var(--blue)" }} />Regularizada</span>
          <span><i style={{ background: "var(--yellow)" }} />Cursando</span>
          <span><i style={{ borderStyle: "dashed" }} />Falta alguna correlativa</span>
        </div>
      </section>

      {sections(materias).map((sec) => (
        <section key={sec.key}>
          <div className="section-title">
            <h2 className="h2">{sec.title}</h2>
            {sec.key === "cbc" && editable && !cbcDone && (
              <button className="btn-ghost small" onClick={() => cbc.forEach((m) => setStatus(m, "aprobada"))}>Marcar CBC completo</button>
            )}
            {sec.key === "cbc" && cbcDone && <span className="small muted">Completo</span>}
          </div>
          <div className="subjects">
            {sec.materias.map((m) => <SubjectCard key={m.id} m={m} st={st} materias={materias} onOpen={() => setOpenId(m.id)} />)}
          </div>
        </section>
      ))}

      <SubjectSheet m={open} materias={materias} st={st} editable={editable} onSet={setStatus} onClose={() => setOpenId(null)} />
    </>
  );
}
