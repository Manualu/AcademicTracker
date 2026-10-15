import { useEffect, useRef } from "react";
import { usePrefs } from "../lib/prefs";
import { AMBIENTS, keepPlaying, pauseAmbient, playAmbient, setNowPlaying } from "../lib/sound";
import { fmtTime } from "../lib/time";
import { useTimer } from "../lib/timer";

/**
 * Hace sonar el ambiente elegido mientras corre la sesión (se calla en pausa y al terminar)
 * y mantiene al día el reproductor de la pantalla bloqueada con la materia y el tiempo.
 */
export function SoundDirector() {
  const { running, paused, elapsedSec } = useTimer();
  const [prefs] = usePrefs();
  const on = !!running && !paused && !!prefs.ambient;

  // Solo se calla al pasar de "sonando por la sesión" a parada/pausa: así no corta la muestra
  // de 10 s cuando elegís un sonido antes de empezar.
  const wasOn = useRef(false);
  useEffect(() => {
    if (on) { keepPlaying(); void playAmbient(prefs.ambient, prefs.ambientVol); }
    else if (wasOn.current) pauseAmbient();
    wasOn.current = on;
  }, [on, prefs.ambient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Texto del reproductor: se actualiza por minuto (no hace falta más seguido)
  const minuteKey = Math.floor(elapsedSec / 60);
  useEffect(() => {
    if (!running || !prefs.ambient) { setNowPlaying(null); return; }
    const amb = AMBIENTS.find((a) => a.k === prefs.ambient)?.n ?? "Sonido";
    let title: string;
    if (paused) title = `${running.subjectName} · en pausa`;
    else if (running.targetMin !== null) {
      const left = Math.max(0, Math.ceil(running.targetMin - elapsedSec / 60));
      const end = new Date(Date.now() + (running.targetMin * 60 - elapsedSec) * 1000);
      title = `${running.subjectName} · quedan ${left} min (termina ${fmtTime(end)})`;
    } else title = `${running.subjectName} · ${Math.floor(elapsedSec / 60)} min`;
    const block = running.pomo ? ` · bloque ${running.pomo.done + 1}` : "";
    setNowPlaying({ title, artist: `Remontada · ${amb}${block}` });
  }, [running, paused, minuteKey, prefs.ambient]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
