export type AvatarConfig = { style: string; seed: string; bg: string };

export type Profile = {
  id: string;
  displayName: string;
  avatar: AvatarConfig;
  planId: string | null;
  notifyFeed: boolean;
  notifyWakeup: boolean;
  notifyExams: boolean;
  notifyWeekly: boolean;
  createdAt: string;
};

export type SubjectState = "cursando" | "regularizada" | "aprobada";

export type SubjectStatus = {
  userId: string;
  planId: string;
  subjectId: string;
  subjectName: string | null;
  status: SubjectState;
  updatedAt: string;
};

/** Id de una pieza del catálogo (ver lib/catalog.ts). Las sesiones viejas pueden traer "tornillo". */
export type PieceKey = string;

export type StudySession = {
  id: string;
  userId: string;
  subjectId: string | null;
  subjectName: string;
  startedAt: string;
  minutes: number;
  source: "timer" | "manual";
  outcome: "completed" | "abandoned";
  piece: PieceKey;
  createdAt: string;
};

export type Activity = {
  id: string;
  userId: string;
  kind: string;
  doneOn: string; // YYYY-MM-DD
  minutes: number | null;
  createdAt: string;
};

export type ExamKind = "parcial" | "recuperatorio" | "final" | "coloquio" | "otro";

export type Exam = {
  id: string;
  createdBy: string;
  subjectName: string;
  kind: ExamKind;
  startsAt: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
};

export type ExamParticipant = { examId: string; userId: string; joinedAt: string };

/** 5 chatarras recicladas en una pieza común. */
export type Recycle = { id: string; userId: string; piece: PieceKey; createdAt: string };

export type GroupData = {
  profiles: Profile[];
  statuses: SubjectStatus[];
  sessions: StudySession[];
  activities: Activity[];
  exams: Exam[];
  participants: ExamParticipant[];
  recycles: Recycle[];
};

export const emptyData = (): GroupData => ({
  profiles: [], statuses: [], sessions: [], activities: [], exams: [], participants: [], recycles: [],
});

/** Cambios que hace el usuario. Se aplican al instante en pantalla y se guardan en una cola
 *  local hasta que el servidor los confirma (así funciona en modo avión). */
export type Op =
  | { kind: "profile.update"; userId: string; patch: Partial<Omit<Profile, "id" | "createdAt">> }
  | { kind: "session.add"; session: StudySession }
  | { kind: "session.delete"; id: string; userId: string }
  | { kind: "activity.add"; activity: Activity }
  | { kind: "activity.delete"; id: string; userId: string }
  | { kind: "exam.add"; exam: Exam }
  | { kind: "exam.delete"; id: string }
  | { kind: "exam.join"; participant: ExamParticipant }
  | { kind: "exam.leave"; examId: string; userId: string }
  | { kind: "recycle.add"; recycle: Recycle }
  | { kind: "status.set"; userId: string; planId: string; subjectId: string; subjectName: string; status: SubjectState | null; at: string };

export type QueuedOp = { qid: string; op: Op };

export type RemoteEvent = { table: string; type: "INSERT" | "UPDATE" | "DELETE"; record: Record<string, unknown> };

export interface Backend {
  readonly isDemo: boolean;
  currentUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, inviteCode: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  fetchAll(): Promise<GroupData>;
  exec(op: Op): Promise<void>;
  subscribe(cb: (e: RemoteEvent) => void): () => void;
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
}
