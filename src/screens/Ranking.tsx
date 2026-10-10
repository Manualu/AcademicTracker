import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, ScreenHead } from "../components/ui";
import { activityRanking, hoursRanking, streakRanking, type RankRow, type Scope } from "../lib/stats";
import { useStore } from "../lib/store";
import { addDays, startOfWeek } from "../lib/time";

type Board = "horas" | "actividad" | "constancia";

const BOARDS: { key: Board; label: string; fn: typeof hoursRanking }[] = [
  { key: "horas", label: "Horas", fn: hoursRanking },
  { key: "actividad", label: "Actividad", fn: activityRanking },
  { key: "constancia", label: "Constancia", fn: streakRanking },
];

const HINT: Record<Board, Record<Scope, string>> = {
  horas: { week: "Horas de estudio de lunes a domingo. La meta es 14.", all: "Promedio diario desde la firma del tratado." },
  actividad: { week: "Veces que entrenaron esta semana. La meta es 3.", all: "Promedio semanal desde la firma del tratado." },
  constancia: { week: "Días con al menos una sesión de estudio.", all: "Días seguidos estudiando, hasta hoy." },
};

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
  const weekLabel = `${ws.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} al ${addDays(ws, 6).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;
  const podium = rows.slice(0, 3);
  const order = [1, 0, 2].filter((i) => podium[i]);

  return (
    <>
      <ScreenHead title="Ranking" sub={scope === "week" ? `Semana del ${weekLabel}` : "Desde que arrancó la Remontada"} />
      <div className="stack">
        <div className="seg" role="group" aria-label="Ranking">
          {BOARDS.map((b) => <button key={b.key} aria-pressed={board === b.key} onClick={() => setBoard(b.key)}>{b.label}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Período">
          <button aria-pressed={scope === "week"} onClick={() => setScope("week")}>Esta semana</button>
          <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>Histórico</button>
        </div>
      </div>

      {rows.length >= 2 && (
        <div className="podium" aria-hidden>
          {order.map((i) => {
            const r = podium[i];
            const p = byId.get(r.userId);
            return (
              <Link key={r.userId} to={`/perfil/${r.userId}`} className={`step ${["first", "second", "third"][i]}`}>
                <Avatar profile={p} size={i === 0 ? 64 : 50} />
                <div className="block">
                  <span className="pos">{positions[i]}</span>
                  <span className="small" style={{ fontWeight: 600 }}>{p?.displayName}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <ol className="rank-list">
          {rows.map((r, i) => {
            const p = byId.get(r.userId);
            return (
              <li key={r.userId}>
                <Link to={`/perfil/${r.userId}`}>
                  <span className="pos">{positions[i]}</span>
                  <Avatar profile={p} size={42} />
                  <span className="grow">
                    <b>{p?.displayName}</b>{r.userId === userId && <span className="me-tag">vos</span>}
                    <div className="small muted">{r.sub}</div>
                  </span>
                  <span className="num" style={{ fontSize: "1.15rem", textAlign: "right" }}>{r.main}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>{HINT[board][scope]}</p>
    </>
  );
}
