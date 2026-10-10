import type { GroupData, Op } from "./types";

/** Aplica un cambio sobre los datos locales. Se usa tanto para mostrar el cambio al instante
 *  como para volver a aplicar lo que sigue en la cola después de bajar datos del servidor. */
export function applyOp(d: GroupData, op: Op): GroupData {
  switch (op.kind) {
    case "profile.update":
      return { ...d, profiles: d.profiles.map((p) => (p.id === op.userId ? { ...p, ...op.patch } : p)) };
    case "session.add":
      if (d.sessions.some((s) => s.id === op.session.id)) return d;
      return { ...d, sessions: [...d.sessions, op.session] };
    case "session.delete":
      return { ...d, sessions: d.sessions.filter((s) => s.id !== op.id) };
    case "activity.add":
      if (d.activities.some((a) => a.id === op.activity.id)) return d;
      return { ...d, activities: [...d.activities, op.activity] };
    case "activity.delete":
      return { ...d, activities: d.activities.filter((a) => a.id !== op.id) };
    case "exam.add":
      if (d.exams.some((e) => e.id === op.exam.id)) return d;
      return {
        ...d,
        exams: [...d.exams, op.exam],
        participants: [...d.participants, { examId: op.exam.id, userId: op.exam.createdBy, joinedAt: op.exam.createdAt }],
      };
    case "exam.delete":
      return { ...d, exams: d.exams.filter((e) => e.id !== op.id), participants: d.participants.filter((p) => p.examId !== op.id) };
    case "exam.join":
      if (d.participants.some((p) => p.examId === op.participant.examId && p.userId === op.participant.userId)) return d;
      return { ...d, participants: [...d.participants, op.participant] };
    case "exam.leave":
      return { ...d, participants: d.participants.filter((p) => !(p.examId === op.examId && p.userId === op.userId)) };
    case "status.set": {
      const rest = d.statuses.filter((s) => !(s.userId === op.userId && s.planId === op.planId && s.subjectId === op.subjectId));
      if (op.status === null) return { ...d, statuses: rest };
      return {
        ...d,
        statuses: [...rest, { userId: op.userId, planId: op.planId, subjectId: op.subjectId, subjectName: op.subjectName, status: op.status, updatedAt: op.at }],
      };
    }
  }
}
