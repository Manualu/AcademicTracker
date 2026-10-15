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
  /** Link a tu playlist (Spotify, YouTube Music, Apple Music…) y si se abre sola al empezar. */
  musicLink: string;
  musicOnStart: boolean;
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
  musicLink: "",
  musicOnStart: true,
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

/** Qué servicio es el link (para mostrarlo lindo). */
export function musicService(link: string): string | null {
  const l = link.trim().toLowerCase();
  if (!/^https?:\/\//.test(l)) return null;
  if (l.includes("spotify.")) return "Spotify";
  if (l.includes("music.youtube.")) return "YouTube Music";
  if (l.includes("youtube.") || l.includes("youtu.be")) return "YouTube";
  if (l.includes("music.apple.")) return "Apple Music";
  if (l.includes("deezer.")) return "Deezer";
  if (l.includes("soundcloud.")) return "SoundCloud";
  return "tu música";
}

/**
 * Abre tu playlist. En el celular, los links de Spotify se abren directo en la app
 * (spotify:playlist:…); el resto, con el link normal (iOS y Android lo pasan a su app).
 */
export function openMusic(link = current.musicLink) {
  const l = link.trim();
  if (!musicService(l)) return false;
  const m = l.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|artist|track|show|episode)\/([A-Za-z0-9]+)/);
  const mobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent) || isIOS();
  if (m && mobile) window.location.href = `spotify:${m[1]}:${m[2]}`;
  else window.open(l, "_blank", "noopener");
  return true;
}

/** Al tocar Empezar: primero el Atajo del modo Estudio (si está activado); si no, tu música. */
export function onSessionStart() {
  if (current.focusShortcuts && isIOS()) { runShortcut("start"); return; }
  if (current.musicOnStart && current.musicLink.trim()) openMusic();
}
