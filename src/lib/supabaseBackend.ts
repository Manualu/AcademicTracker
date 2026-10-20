import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { Backend, GroupData, LiveStudy, Op, Profile, RemoteEvent } from "./types";

type Row = Record<string, any>;

const toProfile = (r: Row): Profile => ({
  id: r.id,
  displayName: r.display_name,
  avatar: r.avatar,
  planId: r.plan_id,
  notifyFeed: r.notify_feed,
  notifyWakeup: r.notify_wakeup,
  notifyExams: r.notify_exams,
  notifyWeekly: r.notify_weekly,
  createdAt: r.created_at,
});

const profilePatch = (p: Partial<Profile>): Row => {
  const out: Row = {};
  if (p.displayName !== undefined) out.display_name = p.displayName;
  if (p.avatar !== undefined) out.avatar = p.avatar;
  if (p.planId !== undefined) out.plan_id = p.planId;
  if (p.notifyFeed !== undefined) out.notify_feed = p.notifyFeed;
  if (p.notifyWakeup !== undefined) out.notify_wakeup = p.notifyWakeup;
  if (p.notifyExams !== undefined) out.notify_exams = p.notifyExams;
  if (p.notifyWeekly !== undefined) out.notify_weekly = p.notifyWeekly;
  return out;
};

/** Trae todas las filas de una tabla, de a 1000 (límite por consulta de Supabase). */
async function all(sb: SupabaseClient, table: string, order: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function check<T extends { error: unknown }>(r: T): T {
  if (r.error) throw r.error;
  return r;
}

export class SupabaseBackend implements Backend {
  readonly isDemo = false;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  onAuthChange(cb: (userId: string | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((event, session) => {
      // Sin conexión puede fallar la renovación del token: no lo tomamos como cierre de sesión
      if (event === "SIGNED_OUT") cb(null);
      else if (session) cb(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Mail o contraseña incorrectos." : error.message);
  }

  async signUp(email: string, password: string, displayName: string, inviteCode: string) {
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, invite_code: inviteCode } },
    });
    if (error) {
      if (/database error/i.test(error.message)) throw new Error("El código de invitación no es correcto.");
      if (/already registered/i.test(error.message)) throw new Error("Ya hay una cuenta con ese mail. Iniciá sesión.");
      throw new Error(error.message);
    }
    return { needsConfirmation: !data.session };
  }

  async signOut() {
    if (this.pres) { await this.sb.removeChannel(this.pres); this.pres = null; this.presJoined = false; this.presMe = null; }
    await this.sb.auth.signOut();
  }

  async fetchAll(): Promise<GroupData> {
    const [profiles, statuses, sessions, activities, exams, participants, recycles] = await Promise.all([
      all(this.sb, "profiles", "created_at"),
      all(this.sb, "subject_status", "updated_at"),
      all(this.sb, "study_sessions", "started_at"),
      all(this.sb, "activities", "created_at"),
      all(this.sb, "exams", "starts_at"),
      all(this.sb, "exam_participants", "joined_at"),
      all(this.sb, "recycles", "created_at").catch(() => []), // la tabla llega con la migración 0002
    ]);
    return {
      profiles: profiles.map(toProfile),
      statuses: statuses.map((r) => ({
        userId: r.user_id, planId: r.plan_id, subjectId: r.subject_id, subjectName: r.subject_name, status: r.status, updatedAt: r.updated_at,
      })),
      sessions: sessions.map((r) => ({
        id: r.id, userId: r.user_id, subjectId: r.subject_id, subjectName: r.subject_name, startedAt: r.started_at,
        minutes: r.minutes, source: r.source, outcome: r.outcome, piece: r.piece, createdAt: r.created_at,
      })),
      activities: activities.map((r) => ({
        id: r.id, userId: r.user_id, kind: r.kind, doneOn: r.done_on, minutes: r.minutes, createdAt: r.created_at,
      })),
      exams: exams.map((r) => ({
        id: r.id, createdBy: r.created_by, subjectName: r.subject_name, kind: r.kind, startsAt: r.starts_at,
        location: r.location, notes: r.notes, createdAt: r.created_at, durationMin: r.duration_min ?? null,
      })),
      participants: participants.map((r) => ({ examId: r.exam_id, userId: r.user_id, joinedAt: r.joined_at })),
      recycles: recycles.map((r) => ({ id: r.id, userId: r.user_id, piece: r.piece, createdAt: r.created_at })),
    };
  }

  async exec(op: Op) {
    const sb = this.sb;
    switch (op.kind) {
      case "profile.update":
        check(await sb.from("profiles").update(profilePatch(op.patch)).eq("id", op.userId));
        return;
      case "session.add": {
        const s = op.session;
        check(await sb.from("study_sessions").upsert({
          id: s.id, subject_id: s.subjectId, subject_name: s.subjectName, started_at: s.startedAt,
          minutes: s.minutes, source: s.source, outcome: s.outcome, piece: s.piece,
        }, { onConflict: "id", ignoreDuplicates: true }));
        return;
      }
      case "session.delete":
        check(await sb.from("study_sessions").delete().eq("id", op.id));
        return;
      case "session.update":
        check(await sb.from("study_sessions").update({ subject_id: op.patch.subjectId, subject_name: op.patch.subjectName }).eq("id", op.id));
        return;
      case "activity.add": {
        const a = op.activity;
        check(await sb.from("activities").upsert(
          { id: a.id, kind: a.kind, done_on: a.doneOn, minutes: a.minutes },
          { onConflict: "id", ignoreDuplicates: true },
        ));
        return;
      }
      case "activity.delete":
        check(await sb.from("activities").delete().eq("id", op.id));
        return;
      case "exam.add": {
        const e = op.exam;
        check(await sb.from("exams").upsert({
          id: e.id, subject_name: e.subjectName, kind: e.kind, starts_at: e.startsAt, location: e.location, notes: e.notes,
          ...(e.kind === "grupal" ? { duration_min: e.durationMin ?? null } : {}),
        }, { onConflict: "id", ignoreDuplicates: true }));
        check(await sb.from("exam_participants").upsert({ exam_id: e.id }, { onConflict: "exam_id,user_id", ignoreDuplicates: true }));
        return;
      }
      case "exam.delete":
        check(await sb.from("exams").delete().eq("id", op.id));
        return;
      case "exam.join":
        check(await sb.from("exam_participants").upsert({ exam_id: op.participant.examId }, { onConflict: "exam_id,user_id", ignoreDuplicates: true }));
        return;
      case "exam.leave":
        check(await sb.from("exam_participants").delete().eq("exam_id", op.examId).eq("user_id", op.userId));
        return;
      case "recycle.add":
        check(await sb.from("recycles").upsert({ id: op.recycle.id, piece: op.recycle.piece }, { onConflict: "id", ignoreDuplicates: true }));
        return;
      case "status.set":
        if (op.status === null) {
          check(await sb.from("subject_status").delete().eq("user_id", op.userId).eq("plan_id", op.planId).eq("subject_id", op.subjectId));
        } else {
          check(await sb.from("subject_status").upsert({
            plan_id: op.planId, subject_id: op.subjectId, subject_name: op.subjectName, status: op.status, updated_at: op.at,
          }, { onConflict: "user_id,plan_id,subject_id" }));
        }
        return;
    }
  }

  subscribe(cb: (e: RemoteEvent) => void) {
    const channel = this.sb
      .channel("grupo")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        cb({
          table: payload.table,
          type: payload.eventType as RemoteEvent["type"],
          record: (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>,
        });
      })
      .subscribe();
    return () => { this.sb.removeChannel(channel); };
  }

  // ------------------------------------------------------------ presencia en vivo
  // Canal de Realtime Presence: cada uno publica si está estudiando. No toca la base y se
  // limpia solo cuando el celular se desconecta (por ejemplo, en modo avión).
  private pres: RealtimeChannel | null = null;
  private presJoined = false;
  private presMe: string | null = null;
  private presLive: LiveStudy | null = null;
  private presCbs = new Set<(live: Record<string, LiveStudy>) => void>();

  private ensurePresence(userId: string) {
    if (this.pres && this.presMe === userId) return;
    if (this.pres) { void this.sb.removeChannel(this.pres); this.pres = null; this.presJoined = false; }
    this.presMe = userId;
    const ch = this.sb.channel("presencia", { config: { presence: { key: userId } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, { live?: LiveStudy | null }[]>;
      const out: Record<string, LiveStudy> = {};
      for (const [k, metas] of Object.entries(state)) {
        if (k === userId) continue;
        const live = metas[metas.length - 1]?.live;
        if (live) out[k] = live;
      }
      this.presCbs.forEach((cb) => cb(out));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") { this.presJoined = true; await ch.track({ live: this.presLive }); }
      else if (status === "CLOSED" || status === "CHANNEL_ERROR") this.presJoined = false;
    });
    this.pres = ch;
  }

  setPresence(userId: string, live: LiveStudy | null) {
    this.presLive = live;
    this.ensurePresence(userId);
    if (this.presJoined) void this.pres!.track({ live }).catch(() => { /* se reintenta al reconectar */ });
  }

  onPresence(cb: (live: Record<string, LiveStudy>) => void) {
    this.presCbs.add(cb);
    return () => { this.presCbs.delete(cb); };
  }

  async savePushSubscription(sub: PushSubscriptionJSON) {
    check(await this.sb.from("push_subscriptions").upsert({
      endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth,
    }, { onConflict: "endpoint" }));
  }

  async deletePushSubscription(endpoint: string) {
    check(await this.sb.from("push_subscriptions").delete().eq("endpoint", endpoint));
  }
}

/** Distingue "no hay conexión" de un error real (permiso, dato inválido). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String((e as { message?: string })?.message ?? e);
  return /failed to fetch|networkerror|network request failed|load failed/i.test(msg);
}
