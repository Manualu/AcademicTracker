// Utilidades compartidas por las funciones "notify" y "scheduled".
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:remontada@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

export type Push = { title: string; body: string; url?: string; tag?: string };
export type Profile = {
  id: string;
  display_name: string;
  notify_feed: boolean;
  notify_wakeup: boolean;
  notify_exams: boolean;
  notify_weekly: boolean;
};

export function checkSecret(req: Request): boolean {
  return req.headers.get("x-notify-secret") === Deno.env.get("NOTIFY_SECRET");
}

export async function profiles(): Promise<Profile[]> {
  const { data, error } = await admin.from("profiles").select("id, display_name, notify_feed, notify_wakeup, notify_exams, notify_weekly");
  if (error) throw error;
  return data as Profile[];
}

/** Envía la misma notificación a varias personas (a todos sus dispositivos). */
export async function sendTo(userIds: string[], push: Push): Promise<number> {
  return sendEach(userIds.map((id) => [id, push]));
}

/** Envía una notificación distinta a cada persona. */
export async function sendEach(items: [string, Push][]): Promise<number> {
  if (items.length === 0) return 0;
  const ids = [...new Set(items.map(([id]) => id))];
  const { data: subs, error } = await admin.from("push_subscriptions").select("endpoint, user_id, p256dh, auth").in("user_id", ids);
  if (error) throw error;
  let sent = 0;
  await Promise.all(
    items.flatMap(([userId, push]) =>
      (subs ?? []).filter((s) => s.user_id === userId).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(push),
            { TTL: 60 * 60 * 12 },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // El dispositivo ya no existe o revocó el permiso: se borra la suscripción
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          else console.error("push error", code, e);
        }
      })
    ),
  );
  return sent;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Argentina no tiene horario de verano: UTC-3 todo el año
export const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Fecha local de Buenos Aires (YYYY-MM-DD) de un instante. */
export function arDate(d: Date): string {
  return new Date(d.getTime() - AR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Lunes 00:00 (hora de Buenos Aires) de la semana del instante dado, como Date UTC. */
export function arWeekStart(d: Date): Date {
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = lunes
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
  return new Date(monday + AR_OFFSET_MS);
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
