import { useState } from "react";
import { useStore } from "../lib/store";
import { addDays, dayKey, uuid } from "../lib/time";
import { Icon, Sheet } from "./ui";

const KINDS = ["Running", "Gimnasio", "Fútbol", "Bici", "Natación", "Pádel", "Caminata", "Yoga"];
const DAYS = [{ label: "Hoy", d: 0 }, { label: "Ayer", d: -1 }, { label: "Anteayer", d: -2 }];
const MINS = [30, 45, 60, 90];

export function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, dispatch, toast } = useStore();
  const [kind, setKind] = useState<string>("Running");
  const [other, setOther] = useState("");
  const [day, setDay] = useState(0);
  const [mins, setMins] = useState<number | null>(60);

  const finalKind = kind === "Otra" ? other.trim() : kind;

  function save() {
    if (!userId || !finalKind) return;
    dispatch({
      kind: "activity.add",
      activity: { id: uuid(), userId, kind: finalKind, doneOn: dayKey(addDays(new Date(), day)), minutes: mins, createdAt: new Date().toISOString() },
    });
    toast({ tone: "success", title: "Actividad registrada", body: "El grupo ya la ve en el inicio.", icon: "run" });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} label="Registrar actividad física" title="Actividad física" eyebrow="Meta: 3 por semana">
      <div className="stack" style={{ gap: 16 }}>
        <div className="field"><span>Qué hiciste</span>
        <div className="chips" role="group" aria-label="Tipo">
          {[...KINDS, "Otra"].map((k) => (
            <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div></div>
        {kind === "Otra" && (
          <input className="input" placeholder="¿Qué hiciste?" value={other} onChange={(e) => setOther(e.target.value)} maxLength={40} autoFocus />
        )}
        <div className="field">
          <span>Cuándo</span>
          <div className="seg" role="group" aria-label="Día">
            {DAYS.map((x) => <button key={x.d} aria-pressed={day === x.d} onClick={() => setDay(x.d)}>{x.label}</button>)}
          </div>
        </div>
        <div className="field">
          <span>Duración (opcional)</span>
          <div className="chips" role="group" aria-label="Duración">
            {MINS.map((m) => <button key={m} className="chip" aria-pressed={mins === m} onClick={() => setMins(m)}>{m} min</button>)}
            <button className="chip" aria-pressed={mins === null} onClick={() => setMins(null)}>Sin dato</button>
          </div>
        </div>
        <button className="btn primary big block" onClick={save} disabled={!finalKind}><Icon name="check" size={20} stroke={2.6} />Registrar {finalKind ? finalKind.toLowerCase() : "actividad"}</button>
      </div>
    </Sheet>
  );
}
