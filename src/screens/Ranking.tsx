import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Icon, isoWeek, ScreenHead } from "../components/ui";
import { activityRanking, hoursRanking, streakRanking, type RankRow, type Scope } from "../lib/stats";
import { useStore } from "../lib/store";
import { addDays, fmtHours, fmtMinutes, startOfWeek } from "../lib/time";

type Board = "horas" | "actividad" | "constancia";

const BOARDS: { key: Board; label: string; fn: typeof hoursRanking }[] = [
  { key: "horas", label: "Horas", fn: hoursRanking },
  { key: "actividad", label: "Actividad", fn: activityRanking },
  { key: "constancia", label: "Constancia", fn: streakRanking },
];

const HINT: Record<Board, Record<Scope, string>> = {
  horas: { week: "Horas de estudio de lunes a domingo. La meta es 14 (la línea verde).", all: "Promedio diario desde la firma del tratado." },
  actividad: { week: "Veces que entrenaron esta semana. La meta es 3 (la línea verde).", all: "Promedio semanal desde la firma del tratado." },
  constancia: { week: "Días con al menos una sesión de estudio.", all: "Días seguidos estudiando, hasta hoy." },
};

/** Meta de la tabla, en las mismas unidades que `value` (si tiene). */
function goalOf(board: Board, scope: Scope): number | null {
  if (scope === "week" && board === "horas") return 14 * 60;
  if (scope === "week" && board === "actividad") return 3;
  if (scope === "all" && board === "horas") return 120; // 2 h por día
  if (scope === "all" && board === "actividad") return 3;
  return null;
}

function gapText(board: Board, scope: Scope, diff: number): string {
  if (board === "horas") return scope === "week" ? fmtMinutes(Math.ceil(diff)) : `${fmtHours(diff, 2)} h/día`;
  if (board === "actividad") return scope === "week" ? `${Math.ceil(diff)} ${Math.ceil(diff) === 1 ? "actividad" : "actividades"}` : `${fmtHours(diff * 60)} por semana`;
  const days = Math.max(1, Math.ceil(diff / 1000));
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export default function Ranking() {
  const { data, userId } = useStore();
  const [board, setBoard] = useState<Board>("horas");
  const [scope, setScope] = useState<Scope>("week");
  const rows: RankRow[] = useMemo(() => BOARDS.find((b) => b.key === board)!.fn(data, scope), [data, board, scope]);
  const byId = new Map(data.profiles.map((p) => [p.id, p]));

  // Posiciones con empates: mismo valor, mismo puesto
  const positions = rows.map((r, i) => (i > 0 && rows[i - 1].value === r.value ? -1 : i + 1));
  for (let i = 1; i < positions.length; i++) if (positions[i] === -1) positions[i] = positions[i - 1];

  const ws = startOfWeek();
  const fmtD = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
  const podium = rows.slice(0, 3);
  const order = [1, 0, 2].filter((i) => podium[i]);
  const goal = goalOf(board, scope);
  const maxV = Math.max(goal ?? 0, ...rows.map((r) => r.value), 1);

  const myIdx = rows.findIndex((r) => r.userId === userId);
  const me = rows[myIdx];
  const ahead = myIdx > 0 ? rows.slice(0, myIdx).reverse().find((r) => r.value > me.value) : undefined;
  const behind = myIdx >= 0 ? rows.slice(myIdx + 1).find((r) => r.value < me.value) : undefined;

  return (
    <>
      <ScreenHead
        eyebrow={scope === "week" ? `Semana ${isoWeek()} · ${fmtD(ws)} al ${fmtD(addDays(ws, 6))}` : "Desde la firma del tratado"}
        title="Ranking"
      />
      <div className="stack">
        <div className="seg" role="group" aria-label="Ranking">
          {BOARDS.map((b) => <button key={b.key} aria-pressed={board === b.key} onClick={() => setBoard(b.key)}>{b.label}</button>)}
        </div>
      </div>

      <section className="console rank-hero" style={{ marginTop: 12 }}>
        <div className="row between">
          <p className="eyebrow">{BOARDS.find((b) => b.key === board)!.label} · {scope === "week" ? "esta semana" : "histórico"}</p>
          <div className="seg" role="group" aria-label="Período" style={{ background: "rgba(255,255,255,.07)", padding: 3 }}>
            {(["week", "all"] as Scope[]).map((s) => (
              <button key={s} aria-pressed={scope === s} onClick={() => setScope(s)}
                style={scope === s ? { background: "var(--yellow)", color: "var(--on-yellow)", padding: "5px 10px", fontSize: ".78rem" } : { color: "var(--con-ink-2)", padding: "5px 10px", fontSize: ".78rem" }}>
                {s === "week" ? "Semana" : "Histórico"}
              </button>
            ))}
          </div>
        </div>
        {rows.length >= 2 && (
          <div className="podium" aria-hidden>
            {order.map((i) => {
              const r = podium[i];
              const p = byId.get(r.userId);
              return (
                <Link key={r.userId} to={`/perfil/${r.userId}`} className={`step ${["first", "second", "third"][i]}`}>
                  <div className="who">
                    {i === 0 && <span style={{ color: "var(--yellow)", marginBottom: -4 }}><Icon name="crown" size={20} /></span>}
                    <Avatar profile={p} size={i === 0 ? 66 : 52} />
                    <span className="nm">{p?.id === userId ? "Vos" : p?.displayName}</span>
                    <span className="val">{r.main}</span>
                  </div>
                  <div className="block"><span className="pos">{positions[i]}</span></div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="podium-floor" />
      </section>

      {me && (ahead || behind) && (
        <div className="callout" style={{ marginTop: 14 }}>
          <Icon name={ahead ? "bolt" : "flame"} size={22} />
          <div className="grow small">
            {ahead ? (
              <>Te faltan <b>{gapText(board, scope, ahead.value - me.value)}</b> para pasar a <b>{byId.get(ahead.userId)?.displayName}</b>.</>
            ) : (
              <>Le sacás <b>{gapText(board, scope, me.value - behind!.value)}</b> a <b>{byId.get(behind!.userId)?.displayName}</b>. No aflojes.</>
            )}
          </div>
          <span className="num">#{positions[myIdx]}</span>
        </div>
      )}

      <div className="section-title"><h2 className="h2">Tabla</h2><span className="eyebrow">{rows.length} en el grupo</span></div>
      <div className="card tight">
        <ol className="rank-list">
          {rows.map((r, i) => {
            const p = byId.get(r.userId);
            return (
              <li key={r.userId} className={r.userId === userId ? "me" : ""}>
                <Link to={`/perfil/${r.userId}`}>
                  <span className={`pos ${positions[i] === 1 ? "p1" : ""}`}>{String(positions[i]).padStart(2, "0")}</span>
                  <Avatar profile={p} size={40} />
                  <span style={{ minWidth: 0 }}>
                    <b>{p?.displayName}</b>{r.userId === userId && <span className="me-tag">vos</span>}
                    <div className="tiny muted ellipsis">{r.sub}</div>
                    <div className="bar">
                      <b style={{ width: `${Math.min(100, (r.value / maxV) * 100)}%`, animationDelay: `${i * 60}ms` }} />
                      {goal !== null && <span className="goal" style={{ left: `${Math.min(100, (goal / maxV) * 100)}%` }} />}
                    </div>
                  </span>
                  <span className="val"><span className="num">{r.main}</span></span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="small muted" style={{ margin: "12px 2px 0" }}>{HINT[board][scope]}</p>
    </>
  );
}
