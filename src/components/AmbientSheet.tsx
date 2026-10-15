import { isIOS, usePrefs } from "../lib/prefs";
import { AMBIENTS, playAmbient, pauseAmbient, PREVIEW_SEC, previewAmbient, setAmbientVolume, useAmbient } from "../lib/sound";
import { useTimer } from "../lib/timer";
import { Icon, Sheet } from "./ui";

/** Elegir el sonido de fondo para estudiar. Se escucha al tocar (prueba) y queda guardado. */
export function AmbientSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = usePrefs();
  const { running, paused } = useTimer();
  const amb = useAmbient();
  const live = !!running && !paused;
  // Elegir uno lo hace sonar: durante la sesión queda sonando; si no, es una muestra de 10 segundos
  const pick = (k: typeof prefs.ambient) => {
    setPrefs({ ambient: k });
    if (!k) pauseAmbient();
    else if (live) void playAmbient(k, prefs.ambientVol);
    else void previewAmbient(k, prefs.ambientVol);
  };
  const previewing = amb.previewUntil > 0 && amb.playing;
  const close = () => {
    // Si no hay sesión corriendo, la prueba se apaga al cerrar
    if (!running || paused) pauseAmbient();
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} label="Sonido de fondo" title="Sonido de fondo" eyebrow="Mientras estudiás">
      <div className="stack" style={{ gap: 12 }}>
        <div className="amb-grid" role="radiogroup" aria-label="Sonido">
          <button role="radio" aria-checked={!prefs.ambient} className="amb" onClick={() => pick(null)}>
            <Icon name="mute" size={22} /><b>Silencio</b><span className="amb-d">Sin sonido</span>
          </button>
          {AMBIENTS.map((a) => (
            <button key={a.k} role="radio" aria-checked={prefs.ambient === a.k} className="amb" onClick={() => pick(a.k)}>
              <span className={`amb-wave w-${a.k}`} aria-hidden><i /><i /><i /><i /><i /></span>
              <b>{a.n}</b><span className="amb-d">{a.d}</span>
              {prefs.ambient === a.k && previewing && (
                <span className="amb-preview" key={amb.previewUntil}>Escuchando · {PREVIEW_SEC} s<i style={{ animationDuration: `${PREVIEW_SEC}s` }} /></span>
              )}
            </button>
          ))}
        </div>
        {!isIOS() && (
          <label className="field">
            <span>Volumen</span>
            <input type="range" min={0.1} max={1} step={0.05} value={prefs.ambientVol}
              onChange={(e) => { const v = Number(e.target.value); setPrefs({ ambientVol: v }); setAmbientVolume(v); }} />
          </label>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>
          Tocá uno para escuchar {PREVIEW_SEC} segundos. Suena mientras corre la sesión y se calla en las pausas. Con el celular bloqueado sigue sonando y en la pantalla bloqueada ves la materia y el tiempo que queda.
          {isIOS() && " En iPhone el volumen se maneja con los botones del costado."}
        </p>
        <button className="btn primary block" onClick={close}>Listo</button>
      </div>
    </Sheet>
  );
}
