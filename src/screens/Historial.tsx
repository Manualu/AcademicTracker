import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IsoPiece } from "../components/IsoPiece";
import { Icon, ScreenHead, Sheet } from "../components/ui";
import { pieceName } from "../lib/catalog";
import { useStore } from "../lib/store";
import { capitalize, dayKey, fmtMinutes, fmtTime, parseDay } from "../lib/time";
import type { StudySession } from "../lib/types";
import { SubjectPicker, type Subj } from "./Estudiar";

const PAGE_DAYS = 21;

const dayTitle = (key: string) => {
  const today = dayKey(new Date());
  const yest = dayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Hoy";
  if (key === yest) return "Ayer";
  const d = parseDay(key);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return capitalize(d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) }));
};
const endOf = (s: StudySession) => new Date(new Date(s.startedAt).getTime() + s.minutes * 60_000);
const pieceOf = (s: StudySession) => (s.outcome === "abandoned" ? "chatarra" : s.piece);

/**
 * Historial de tus sesiones de estudio. Solo se puede hacer dos cosas con cada una:
 * corregir la materia o borrarla. El horario, la duración y la pieza no se tocan.
 */
export default function Historial() {
  const { data, userId } = useStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [days, setDays] = useState(PAGE_DAYS);
  const [openId, setOpenId] = useState<string | null>(null);

  const mine = useMemo(
    () => data.sessions.filter((s) => s.userId === userId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [data.sessions, userId],
  );
  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of mine) m.set(s.subjectName, (m.get(s.subjectName) ?? 0) + s.minutes);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [mine]);
  const list = filter ? mine.filter((s) => s.subjectName === filter) : mine;
  const groups = useMemo(() => {
    const out: { key: string; items: StudySession[]; total: number }[] = [];
    for (const s of list) {
      const k = dayKey(s.startedAt);
      let g = out[out.length - 1];
      if (!g || g.key !== k) { g = { key: k, items: [], total: 0 }; out.push(g); }
      g.items.push(s); g.total += s.minutes;
    }
    return out;
  }, [list]);
  const shown = groups.slice(0, days);
  const total = list.reduce((a, s) => a + s.minutes, 0);
  const opened = mine.find((s) => s.id === openId) ?? null;

  return (
    <>
      <ScreenHead eyebrow="Tus sesiones" title="Historial"
        sub="Tocá una sesión para corregir la materia o borrarla."
        right={<Link to="/estudiar" className="btn sm"><Icon name="play" size={15} />Estudiar</Link>} />

      {mine.length === 0 ? (
        <div className="card"><div className="empty">Todavía no hay sesiones. Cuando estudies, aparecen acá.</div></div>
      ) : (
        <>
          <div className="hist-summary">
            <div><span className="display">{mine.length}</span><span className="eyebrow">sesiones</span></div>
            <div><span className="display">{(mine.reduce((a, s) => a + s.minutes, 0) / 60).toFixed(1).replace(".", ",")}</span><span className="eyebrow">horas</span></div>
            <div><span className="display">{subjects.length}</span><span className="eyebrow">materias</span></div>
          </div>

          {subjects.length > 1 && (
            <div className="chips hist-filter" role="group" aria-label="Filtrar por materia">
              <button className="chip" aria-pressed={!filter} onClick={() => setFilter(null)}>Todas</button>
              {subjects.map(([name, min]) => (
                <button key={name} className="chip" aria-pressed={filter === name} onClick={() => setFilter(filter === name ? null : name)}>
                  {name} <span className="faint">· {fmtMinutes(min)}</span>
                </button>
              ))}
            </div>
          )}
          {filter && <p className="small muted" style={{ margin: "4px 2px 0" }}>{list.length} sesiones · {fmtMinutes(total)} de {filter}</p>}

          {shown.map((g) => (
            <section key={g.key}>
              <div className="section-title"><h2 className="h2">{dayTitle(g.key)}</h2><span className="eyebrow">{fmtMinutes(g.total)}</span></div>
              <div className="card tight">
                <ul className="feed hist-list">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <button className="hist-row" onClick={() => setOpenId(s.id)} aria-label={`${s.subjectName}, ${fmtMinutes(s.minutes)}. Editar`}>
                        <IsoPiece piece={pieceOf(s)} size={46} />
                        <span className="grow">
                          <span className="what"><b>{s.subjectName}</b></span>
                          <span className="when">
                            {fmtTime(s.startedAt)} a {fmtTime(endOf(s))} · {fmtMinutes(s.minutes)}
                            {s.source === "manual" ? " · a mano" : ""}{s.outcome === "abandoned" ? " · cortada" : ""}
                          </span>
                        </span>
                        <Icon name="edit" size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
          {groups.length > days && (
            <button className="btn block" style={{ marginTop: 14 }} onClick={() => setDays((d) => d + PAGE_DAYS)}>Ver días anteriores</button>
          )}
        </>
      )}
      <SessionSheet session={opened} onClose={() => setOpenId(null)} />
    </>
  );
}

function SessionSheet({ session, onClose }: { session: StudySession | null; onClose: () => void }) {
  const { dispatch, toast } = useStore();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!session) return null;
  const close = () => { setEditing(false); setConfirmDel(false); setSubject(null); onClose(); };
  const s = session;
  const newName = subject?.name.trim() ?? "";
  const changed = !!newName && newName !== s.subjectName;
  const saveSubject = () => {
    if (!changed) return;
    dispatch({ kind: "session.update", id: s.id, userId: s.userId, patch: { subjectId: subject!.id, subjectName: newName.slice(0, 80) } });
    toast({ tone: "success", title: "Materia corregida", body: `${fmtMinutes(s.minutes)} ahora cuentan para ${newName}.` });
    close();
  };
  const remove = () => {
    dispatch({ kind: "session.delete", id: s.id, userId: s.userId });
    toast({ title: "Sesión borrada", body: `Se descontaron ${fmtMinutes(s.minutes)} de ${s.subjectName}.` });
    close();
  };
  const d = new Date(s.startedAt);
  return (
    <Sheet open onClose={close} label="Sesión de estudio" title={s.subjectName} eyebrow={dayTitle(dayKey(d))}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="card tight hist-detail">
          <IsoPiece piece={pieceOf(s)} size={64} />
          <div className="grow">
            <div><b>{fmtTime(d)} a {fmtTime(endOf(s))}</b> · {fmtMinutes(s.minutes)}</div>
            <div className="small muted">
              {s.source === "manual" ? "Cargada a mano" : "Con el cronómetro"}{s.outcome === "abandoned" ? " · cortada antes de tiempo" : ""} · {pieceName(pieceOf(s))}
            </div>
          </div>
        </div>

        {confirmDel ? (
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ margin: 0 }}>¿Borrás esta sesión? Se descuentan <b>{fmtMinutes(s.minutes)}</b> de tus horas y la pieza sale de tu nave. No se puede deshacer.</p>
            <div className="row">
              <button className="btn grow" onClick={() => setConfirmDel(false)}>No, dejarla</button>
              <button className="btn danger solid grow" onClick={remove}><Icon name="trash" size={16} />Borrar</button>
            </div>
          </div>
        ) : editing ? (
          <div className="stack" style={{ gap: 10 }}>
            <p className="eyebrow" style={{ margin: 0 }}>¿De qué materia fue?</p>
            <SubjectPicker value={subject} onChange={setSubject} />
            <p className="tiny muted" style={{ margin: 0 }}>Se cambia solo la materia: el horario, la duración y la pieza quedan igual.</p>
            <div className="row">
              <button className="btn grow" onClick={() => { setEditing(false); setSubject(null); }}>Cancelar</button>
              <button className="btn primary grow" disabled={!changed} onClick={saveSubject}>Guardar</button>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <button className="btn primary block" onClick={() => setEditing(true)}><Icon name="edit" size={17} />Cambiar la materia</button>
            <button className="btn danger block" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} />Borrar la sesión</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
