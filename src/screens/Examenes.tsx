import { useMemo, useState } from "react";
import { Avatar, Icon, ScreenHead, Sheet } from "../components/ui";
import { useMe, useStore } from "../lib/store";
import { addDays, capitalize, dayKey, daysUntil, fmtTime, startOfWeek, uuid } from "../lib/time";
import type { Exam, ExamKind } from "../lib/types";

const KINDS: { key: ExamKind; label: string }[] = [
  { key: "parcial", label: "Parcial" },
  { key: "recuperatorio", label: "Recuperatorio" },
  { key: "final", label: "Final" },
  { key: "coloquio", label: "Coloquio" },
  { key: "otro", label: "Otro" },
];
const kindLabel = (k: ExamKind) => KINDS.find((x) => x.key === k)!.label;
const short = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("es-AR", o).replace(".", "");

function countdownText(n: number) {
  if (n < 0) return "Pasó";
  if (n === 0) return "Hoy";
  if (n === 1) return "Mañana";
  return `${n} días`;
}

function MonthCalendar({ exams, mine, selected, onSelect }: {
  exams: Exam[]; mine: Set<string>; selected: string | null; onSelect: (k: string | null) => void;
}) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastRowNeeded = days.findIndex((d, i) => i % 7 === 0 && d.getMonth() !== first.getMonth() && d > first);
  const shown = lastRowNeeded > 0 ? days.slice(0, lastRowNeeded) : days;
  const byDay = new Map<string, Exam[]>();
  for (const e of exams) {
    const k = dayKey(e.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const today = dayKey(now);
  const inMonth = exams.filter((e) => { const d = new Date(e.startsAt); return d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear(); });
  return (
    <div className="card">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Mes anterior"><Icon name="back" /></button>
        <div className="center">
          <div className="h2">{capitalize(first.toLocaleDateString("es-AR", { month: "long" }))} <span className="faint" style={{ fontWeight: 500 }}>{first.getFullYear()}</span></div>
          <div className="eyebrow" style={{ marginTop: 3 }}>{inMonth.length} {inMonth.length === 1 ? "examen" : "exámenes"} en el grupo</div>
        </div>
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} aria-label="Mes siguiente"><Icon name="next" /></button>
      </div>
      <div className="month">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {shown.map((d, i) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const has = list.length > 0;
          const imIn = list.some((e) => mine.has(e.id));
          const cls = ["d", d.getMonth() !== first.getMonth() && "out", i % 7 >= 5 && "weekend", k === today && "today", has && "has", imIn && "mine", selected === k && "sel"]
            .filter(Boolean).join(" ");
          return (
            <button key={k} className={cls} disabled={!has} onClick={() => onSelect(selected === k ? null : k)}
              aria-label={has ? `${d.getDate()}: ${list.map((e) => e.subjectName).join(", ")}` : undefined}>
              {d.getDate()}
              <span className="marks">{list.slice(0, 3).map((e) => <i key={e.id} className={mine.has(e.id) ? "mine" : ""} />)}</span>
            </button>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span><i style={{ background: "var(--yellow-2)", width: 14 }} />Lo rendís</span>
        <span><i style={{ background: "var(--ink-3)", borderRadius: 5 }} />Lo rinde alguien del grupo</span>
      </div>
    </div>
  );
}

function ExamCard({ exam, onOpen }: { exam: Exam; onOpen: () => void }) {
  const { data, userId } = useStore();
  const people = data.participants.filter((p) => p.examId === exam.id).map((p) => data.profiles.find((x) => x.id === p.userId)).filter(Boolean);
  const imIn = data.participants.some((p) => p.examId === exam.id && p.userId === userId);
  const n = daysUntil(exam.startsAt);
  const d = new Date(exam.startsAt);
  const hot = imIn && n >= 0 && n <= 7;
  return (
    <button className={`ticket ${hot ? "hot" : ""} ${n < 0 ? "past" : ""}`} onClick={onOpen}>
      <div className="stub">
        <span className="eyebrow">{short(d, { weekday: "short" })}</span>
        <span className="num">{d.getDate()}</span>
        <span className="eyebrow">{short(d, { month: "short" })}</span>
      </div>
      <div className="body">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <span className="title">{exam.subjectName}</span>
          <span className="cd">{countdownText(n)}</span>
        </div>
        <span className="small muted ellipsis">{kindLabel(exam.kind)} · {fmtTime(d)} h{exam.location ? ` · ${exam.location}` : ""}</span>
        <div className="row" style={{ marginTop: 6, gap: 8 }}>
          <div className="avatar-stack">{people.map((p) => <Avatar key={p!.id} profile={p} size={24} />)}</div>
          <span className="tiny muted">
            {imIn ? (people.length > 1 ? `Lo rendís con ${people.length - 1} más` : "Lo rendís") : `${people.length} lo ${people.length === 1 ? "rinde" : "rinden"}`}
          </span>
          {!imIn && n >= 0 && <span className="tiny strong" style={{ marginLeft: "auto", color: "var(--blue)" }}>¿Lo rendís?</span>}
        </div>
      </div>
    </button>
  );
}

function NextExam({ exam, onOpen }: { exam: Exam; onOpen: () => void }) {
  const { data, userId } = useStore();
  const n = daysUntil(exam.startsAt);
  const d = new Date(exam.startsAt);
  const others = data.participants.filter((p) => p.examId === exam.id && p.userId !== userId).map((p) => data.profiles.find((x) => x.id === p.userId)).filter(Boolean);
  const hot = n <= 7;
  return (
    <button className="console next-exam" onClick={onOpen} style={{ width: "100%", textAlign: "left", border: 0, font: "inherit", display: "block" }}>
      <p className="eyebrow">Tu próximo examen · {kindLabel(exam.kind)}</p>
      <h2 className="h1" style={{ marginTop: 8 }}>{exam.subjectName}</h2>
      <div className="big">
        <span className="display">{n <= 1 ? (n === 0 ? "Hoy" : "1") : n}</span>
        {n > 0 && <span className="unit">{n === 1 ? "día" : "días"}<br /><span className="muted small" style={{ fontFamily: "var(--body)", fontWeight: 400 }}>{capitalize(short(d, { weekday: "long", day: "numeric", month: "long" }))}, {fmtTime(d)} h</span></span>}
      </div>
      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        {others.length > 0 && <div className="avatar-stack">{others.map((p) => <Avatar key={p!.id} profile={p} size={26} />)}</div>}
        <span className="small muted grow">
          {hot ? "Semana de resolver parciales viejos." : "Todavía hay margen, pero no te confíes."}
          {exam.location ? ` ${exam.location}.` : ""}
        </span>
      </div>
      {hot && <div className="hazard-band" />}
    </button>
  );
}

function ExamDetail({ exam, onClose }: { exam: Exam | null; onClose: () => void }) {
  const { data, userId, dispatch } = useStore();
  if (!exam) return null;
  const people = data.participants.filter((p) => p.examId === exam.id).map((p) => data.profiles.find((x) => x.id === p.userId)).filter(Boolean);
  const imIn = people.some((p) => p!.id === userId);
  const d = new Date(exam.startsAt);
  const past = d < new Date();
  const n = daysUntil(exam.startsAt);
  const author = data.profiles.find((p) => p.id === exam.createdBy);
  return (
    <Sheet open onClose={onClose} label={exam.subjectName} title={exam.subjectName} eyebrow={`${kindLabel(exam.kind)} · ${countdownText(n)}`}>
      <div className="stack">
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row"><Icon name="calendar" size={20} /><span><b>{capitalize(short(d, { weekday: "long", day: "numeric", month: "long" }))}</b>, {fmtTime(d)} h</span></div>
          {exam.location && <div className="row"><Icon name="pin" size={20} /><span>{exam.location}</span></div>}
          {exam.notes && <div className="row" style={{ alignItems: "flex-start" }}><Icon name="book" size={20} /><span className="small">{exam.notes}</span></div>}
        </div>
        <div className="card tight">
          <p className="eyebrow" style={{ padding: "12px 0 4px" }}>Lo rinden · {people.length}</p>
          <ul className="feed">
            {people.map((p) => (
              <li key={p!.id}><Avatar profile={p} size={34} /><span className="grow strong">{p!.displayName}</span>{p!.id === userId && <span className="me-tag">vos</span>}</li>
            ))}
          </ul>
        </div>
        {!past && (imIn ? (
          <button className="btn block" onClick={() => { dispatch({ kind: "exam.leave", examId: exam.id, userId: userId! }); onClose(); }}>Ya no lo rindo</button>
        ) : (
          <button className="btn primary big block" onClick={() => { dispatch({ kind: "exam.join", participant: { examId: exam.id, userId: userId!, joinedAt: new Date().toISOString() } }); onClose(); }}>
            <Icon name="plus" size={20} />Yo también lo rindo
          </button>
        ))}
        {exam.createdBy === userId ? (
          <button className="btn danger block" onClick={() => { if (confirm("¿Borrar este examen para todo el grupo?")) { dispatch({ kind: "exam.delete", id: exam.id }); onClose(); } }}>
            <Icon name="trash" size={18} />Borrar examen
          </button>
        ) : author && <p className="tiny faint center" style={{ margin: 0 }}>Lo agendó {author.displayName}</p>}
      </div>
    </Sheet>
  );
}

function AddExam({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, userId, dispatch, toast } = useStore();
  const me = useMe();
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<ExamKind>("parcial");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const suggestions = useMemo(() => [...new Set(data.statuses
    .filter((s) => s.userId === userId && s.planId === me?.planId && s.status !== "aprobada" && !s.subjectId.startsWith("CBC"))
    .map((s) => s.subjectName ?? s.subjectId))], [data.statuses, userId, me?.planId]);
  const valid = subject.trim() && date && time;

  function save() {
    if (!valid || !userId) return;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    dispatch({
      kind: "exam.add",
      exam: {
        id: uuid(), createdBy: userId, subjectName: subject.trim(), kind, startsAt: new Date(y, m - 1, d, hh, mm).toISOString(),
        location: location.trim() || null, notes: notes.trim() || null, createdAt: new Date().toISOString(),
      },
    });
    toast({ tone: "success", title: "Examen agendado", body: "Le avisamos al grupo para que se sume quien lo rinda.", icon: "calendar" });
    setSubject(""); setDate(""); setLocation(""); setNotes("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} label="Agendar examen" title="Agendar examen" eyebrow="Para todo el grupo">
      <div className="stack" style={{ gap: 16 }}>
        <label className="field">
          <span>Materia</span>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} list="exam-subjects" placeholder="Probabilidad" />
          <datalist id="exam-subjects">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        {suggestions.length > 0 && (
          <div className="chips" style={{ marginTop: -6 }}>{suggestions.slice(0, 6).map((s) => <button key={s} className="chip" aria-pressed={subject === s} onClick={() => setSubject(s)}>{s}</button>)}</div>
        )}
        <div className="field">
          <span>Tipo</span>
          <div className="chips" role="group" aria-label="Tipo">
            {KINDS.map((k) => <button key={k.key} className="chip" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>)}
          </div>
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <label className="field grow"><span>Día</span><input className="input" type="date" value={date} min={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field" style={{ width: 120 }}><span>Hora</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <label className="field"><span>Lugar (opcional)</span><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Paseo Colón, aula 302" /></label>
        <label className="field"><span>Notas (opcional)</span><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qué temas entran, qué llevar…" /></label>
        <button className="btn primary big block" disabled={!valid} onClick={save}>{valid ? "Agendar examen" : "Completá materia y día"}</button>
      </div>
    </Sheet>
  );
}

export default function Examenes() {
  const { data, userId } = useStore();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const mine = new Set(data.participants.filter((p) => p.userId === userId).map((p) => p.examId));
  const today = dayKey(new Date());
  const sorted = [...data.exams].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = sorted.filter((e) => dayKey(e.startsAt) >= today);
  const past = sorted.filter((e) => dayKey(e.startsAt) < today).reverse();
  const next = upcoming.find((e) => mine.has(e.id) && new Date(e.startsAt) > new Date());
  const list = day ? sorted.filter((e) => dayKey(e.startsAt) === day) : upcoming.filter((e) => e.id !== next?.id);
  const opened = data.exams.find((e) => e.id === openId) ?? null;

  return (
    <>
      <ScreenHead eyebrow="Calendario del grupo" title="Exámenes"
        right={<button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" size={18} stroke={2.4} />Agendar</button>} />

      {next && <div style={{ marginBottom: 14 }}><NextExam exam={next} onOpen={() => setOpenId(next.id)} /></div>}

      <MonthCalendar exams={data.exams} mine={mine} selected={day} onSelect={setDay} />

      <div className="section-title">
        <h2 className="h2">{day ? capitalize(new Date(`${day}T00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })) : next ? "Después" : "Próximos"}</h2>
        {day && <button className="link" onClick={() => setDay(null)}>Ver todos</button>}
      </div>
      <div className="stack">
        {list.length === 0 && (
          <div className="card empty">
            <div className="h2">{next ? "Nada más por ahora" : "No hay exámenes agendados"}</div>
            Agendá el próximo parcial y te avisamos una semana antes para que arranques a practicar.
          </div>
        )}
        {list.map((e) => <ExamCard key={e.id} exam={e} onOpen={() => setOpenId(e.id)} />)}
      </div>

      {!day && past.length > 0 && (
        <>
          <div className="section-title">
            <h2 className="h2">Pasados</h2>
            <button className="link" onClick={() => setShowPast(!showPast)}>{showPast ? "Ocultar" : `Ver ${past.length}`}</button>
          </div>
          {showPast && <div className="stack">{past.map((e) => <ExamCard key={e.id} exam={e} onOpen={() => setOpenId(e.id)} />)}</div>}
        </>
      )}

      <AddExam open={adding} onClose={() => setAdding(false)} />
      <ExamDetail exam={opened} onClose={() => setOpenId(null)} />
    </>
  );
}
