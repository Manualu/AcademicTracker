import type { Backend } from "./types";

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on" | "no-server";

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (!VAPID) return "no-server";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(backend: Backend): Promise<PushState> {
  if (!VAPID) return "no-server";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) }));
  await backend.savePushSubscription(sub.toJSON());
  return "on";
}

export async function disablePush(backend: Backend): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await backend.deletePushSubscription(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}

/** Notificación local (sin servidor), por ejemplo al terminar el cronómetro con la app en segundo plano. */
export async function localNotify(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "./icon-192.png", tag: "timer" });
  } catch { /* sin soporte */ }
}
