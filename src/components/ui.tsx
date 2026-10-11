import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { avatarUri } from "../lib/avatar";
import { useStore } from "../lib/store";
import { fmtClock } from "../lib/time";
import { useTimer } from "../lib/timer";
import type { Profile } from "../lib/types";
import { IsoPiece } from "./IsoPiece";

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, "avatar" | "displayName"> | null | undefined; size?: number }) {
  if (!profile) return <span className="avatar" style={{ width: size, height: size }} aria-hidden />;
  return <img className="avatar" src={avatarUri(profile.avatar)} width={size} height={size} alt="" title={profile.displayName} />;
}

export function Sheet({ open, onClose, children, label, title, eyebrow }: {
  open: boolean; onClose: () => void; children: ReactNode; label: string; title?: ReactNode; eyebrow?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <div className="grow">
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2 className="h1" style={{ fontSize: "1.6rem" }}>{title}</h2>
            </div>
            <button className="icon-btn boxed" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

const paths: Record<string, ReactNode> = {
  home: <><path d="M3.5 10.5L12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5h4v5" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 2.5h5M19 6l1.5-1.5" /></>,
  rank: <><path d="M4 20h16" /><rect x="9.5" y="6" width="5" height="14" rx="1" /><rect x="4" y="11" width="5" height="9" rx="1" /><rect x="15" y="14" width="5" height="6" rx="1" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="15.5" cy="15" r="1.4" fill="currentColor" stroke="none" /></>,
  map: <><rect x="3" y="3.5" width="7" height="5" rx="1.5" /><rect x="14" y="3.5" width="7" height="5" rx="1.5" /><rect x="8.5" y="15.5" width="7" height="5" rx="1.5" /><path d="M6.5 8.5v2.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V8.5M12 13v2.5" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <><rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" /></>,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: <><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  plane: <path d="M10.5 3.5c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5v5l7 4.5v2l-7-2.2v4.7l2 1.5v1.5L12 20l-3.5 1v-1.5l2-1.5v-4.7l-7 2.2v-2l7-4.5z" />,
  run: <><circle cx="15" cy="4.5" r="2" /><path d="M6 20l3.5-5 3 2V21M8 10.5l3-3h4l2 4 3 1M11 7.5l-1.5 6 4 2.5" /></>,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />,
  sync: <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />,
  crown: <path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z" fill="currentColor" strokeWidth={1.5} />,
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  flame: <path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.8 3.3-5.6 4-9.5 2.4 1.4 3.7 3.7 3.5 6.2 1-.6 1.7-1.6 2-2.8 2 1.6 3.5 3.8 3.5 6.1 0 3.4-2.5 6-6.5 6z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  book: <><path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z" /><path d="M4 20.5V5.5M8 7.5h7" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" /><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.7c1.9.6 3.1 2.2 3.5 4.8" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.2" /></>,
  rotl: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" />,
  rotr: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  factory: <><path d="M3 20.5V11l5 3v-3l5 3v-3l5 3V4h3v16.5z" /><path d="M7 17.5h2M12 17.5h2" /></>,
  recycle: <><path d="M7 19H4.5a1.5 1.5 0 0 1-1.3-2.25L5.5 13M12 4.5l-1.3-2.2a1.5 1.5 0 0 0-2.6 0L5.8 6.3" /><path d="M17 19h2.5a1.5 1.5 0 0 0 1.3-2.25L18.5 13M16.5 9.5l-2.3-4" /><path d="M9 19h6M3 9.5l2.8-3.2 3.2 1.5M21 15.5l-2.5 3.5-3.5-.5M12 4.5l4.5 5-4 .5" /></>,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" strokeWidth={1.2} />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  sunset: <><path d="M4 18h16M7 14.5a5 5 0 0 1 10 0" /><path d="M12 4v3M4.9 8.4l1.6 1.6M19.1 8.4l-1.6 1.6M7 21h10" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function BottomNav() {
  const { running, elapsedSec } = useTimer();
  const left = [
    { to: "/", icon: "home", label: "Inicio", end: true },
    { to: "/ranking", icon: "rank", label: "Ranking" },
  ];
  const right = [
    { to: "/examenes", icon: "calendar", label: "Calendario" },
    { to: "/carrera", icon: "map", label: "Carrera" },
  ];
  const item = (it: { to: string; icon: string; label: string; end?: boolean }) => (
    <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
      <span className="nav-ico"><Icon name={it.icon} size={23} stroke={1.9} /></span>
      {it.label}
    </NavLink>
  );
  const clock = running ? fmtClock(running.targetMin ? running.targetMin * 60 - elapsedSec : elapsedSec) : null;
  return (
    <nav className="nav" aria-label="Secciones">
      <div className="nav-inner">
        {left.map(item)}
        <NavLink to="/estudiar" className={({ isActive }) => `fab ${running ? "live" : ""} ${isActive ? "active" : ""}`}
          aria-label={running ? `Estudiando, ${clock}` : "Estudiar"}>
          <span className="fab-btn">{running ? <Icon name="timer" size={26} stroke={2.2} /> : <Icon name="play" size={26} />}</span>
          {running ? <span className="fab-time">{clock}</span> : "Estudiar"}
        </NavLink>
        {right.map(item)}
      </div>
    </nav>
  );
}

export function Toasts() {
  const { toasts, dismiss, data } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const who = t.userId ? data.profiles.find((p) => p.id === t.userId) : undefined;
        return (
          <button key={t.id} className={`toast ${t.tone ?? ""}`} onClick={() => dismiss(t.id)}>
            {who ? <Avatar profile={who} size={36} /> : (
              <span className="tico"><Icon name={t.tone === "error" ? "info" : t.icon ?? "check"} size={18} stroke={2.4} /></span>
            )}
            <span className="grow">
              <strong>{t.title}</strong>
              {t.body && <span className="b">{t.body}</span>}
            </span>
            {t.piece && <IsoPiece piece={t.piece} size={50} height={44} />}
          </button>
        );
      })}
    </div>
  );
}

export function NetBar() {
  const { online, pending } = useStore();
  if (online && pending === 0) return null;
  return (
    <div className="netbar" role="status">
      <Icon name={online ? "sync" : "plane"} size={18} />
      <span className="grow">
        {online
          ? `Sincronizando ${pending} ${pending === 1 ? "registro" : "registros"}…`
          : pending > 0
            ? `Sin señal. ${pending} ${pending === 1 ? "registro se sube" : "registros se suben"} cuando vuelva.`
            : "Sin señal. El cronómetro funciona igual."}
      </span>
    </div>
  );
}

export function ScreenHead({ title, sub, right, eyebrow }: { title: string; sub?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="screen-head">
      <div className="grow">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/** Anillo de progreso simple (SVG). */
export function Ring({ value, size = 58, stroke = 4, color = "var(--yellow-2)", track = "var(--surface-3)", children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ringwrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} style={{ transition: "stroke-dasharray 700ms cubic-bezier(.2,.9,.25,1)" }} />
      </svg>
      {children}
    </div>
  );
}

/** Semana ISO del año, para las etiquetas técnicas. */
export function isoWeek(d = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}
