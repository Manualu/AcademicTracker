import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { avatarUri } from "../lib/avatar";
import { useStore } from "../lib/store";
import { useTimer } from "../lib/timer";
import type { Profile } from "../lib/types";

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, "avatar" | "displayName"> | null | undefined; size?: number }) {
  if (!profile) return <span className="avatar" style={{ width: size, height: size }} aria-hidden />;
  return <img className="avatar" src={avatarUri(profile.avatar)} width={size} height={size} alt="" title={profile.displayName} />;
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
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
        {children}
      </div>
    </div>
  );
}

const paths: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 2.5h5M19 6l1.5-1.5" /></>,
  rank: <path d="M3 20h18M5 20v-7h4v7M10 20V8h4v12M15 20v-4h4v4" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14h2M14 14h2M8 17h2" /></>,
  map: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.5 6h7M7.3 8.2l3.5 7.4M16.7 8.2l-3.5 7.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  plane: <path d="M10.5 3.5c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5v5l7 4.5v2l-7-2.2v4.7l2 1.5v1.5L12 20l-3.5 1v-1.5l2-1.5v-4.7l-7 2.2v-2l7-4.5z" />,
  run: <><circle cx="15" cy="4.5" r="2" /><path d="M6 20l3.5-5 3 2V21M8 10.5l3-3h4l2 4 3 1M11 7.5l-1.5 6 4 2.5" /></>,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />,
  sync: <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />,
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function BottomNav() {
  const { running } = useTimer();
  const items = [
    { to: "/", icon: "home", label: "Inicio", end: true },
    { to: "/estudiar", icon: "timer", label: "Estudiar" },
    { to: "/ranking", icon: "rank", label: "Ranking" },
    { to: "/examenes", icon: "calendar", label: "Exámenes" },
    { to: "/carrera", icon: "map", label: "Carrera" },
  ];
  return (
    <nav className="nav" aria-label="Secciones">
      <div className="nav-inner">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <span className="nav-ico"><Icon name={it.icon} /></span>
            {it.label}
            {it.to === "/estudiar" && running && <span className="live-dot" aria-label="Cronómetro en marcha" />}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone ?? ""}`} onClick={() => dismiss(t.id)}>
          <span className="grow">
            <strong>{t.title}</strong>
            {t.body && <span>{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function NetBar() {
  const { online, pending } = useStore();
  if (online && pending === 0) return null;
  return (
    <div className="netbar" role="status">
      <Icon name={online ? "sync" : "plane"} size={18} />
      {online
        ? `Sincronizando ${pending} ${pending === 1 ? "registro" : "registros"}…`
        : pending > 0
          ? `Sin conexión. ${pending} ${pending === 1 ? "registro se sube" : "registros se suben"} cuando vuelva la señal.`
          : "Sin conexión. Podés seguir usando el cronómetro."}
    </div>
  );
}

export function ScreenHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="screen-head">
      <div className="grow">
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}
