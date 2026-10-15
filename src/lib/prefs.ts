// Preferencias de este dispositivo (sonido, modo Estudio con Atajos). No se suben al servidor:
// cada uno las ajusta en su celular o compu.
import { useEffect, useState } from "react";

export type AmbientKind = "blanco" | "rosa" | "marron" | "lluvia" | "olas" | "fabrica";

export type Prefs = {
  /** Efectos: arranque de máquina, campana de fin de bloque, cajón. */
  sfx: boolean;
  /** Música suave en el parque (Inicio). */
  parkMusic: boolean;
  /** Ambiente que suena durante la sesión (null = silencio). */
  ambient: AmbientKind | null;
  ambientVol: number;
  /** Abrir Atajos de iPhone al empezar y al terminar (modo Concentración). */
  focusShortcuts: boolean;
  shortcutStart: string;
  shortcutEnd: string;
};

const KEY = "remontada.prefs";
const DEFAULTS: Prefs = {
  sfx: true,
  parkMusic: false,
  ambient: null,
  ambientVol: 0.7,
  focusShortcuts: false,
  shortcutStart: "Remontada empezar",
  shortcutEnd: "Remontada terminar",
};

let current: Prefs = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; }
})();
const subs = new Set<(p: Prefs) => void>();

export const getPrefs = () => current;
export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignorar */ }
  subs.forEach((f) => f(current));
}
export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [p, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return [p, setPrefs];
}

export const isIOS = () => typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** Corre un Atajo de iPhone (el que prende o apaga el modo Concentración "Estudio"). */
export function runShortcut(which: "start" | "end") {
  const p = current;
  if (!p.focusShortcuts || !isIOS()) return;
  const name = (which === "start" ? p.shortcutStart : p.shortcutEnd).trim();
  if (!name) return;
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}
