// Planes de estudio de FIUBA, tomados de FIUBA-Map (github.com/fdelmazo/FIUBA-Map, licencia MIT).
// Para actualizarlos: node scripts/build-planes.mjs <ruta-a-FIUBA-Map>
import { useEffect, useState } from "react";
import indexJson from "../data/planes/index.json";
import type { SubjectState, SubjectStatus } from "./types";

export type PlanMeta = { id: string; ano: number; creditosTotal: number; creditosElectivas: number | null };
export type Carrera = { nombre: string; nombreCorto: string; planes: PlanMeta[] };
export type Materia = {
  id: string;
  nombre: string;
  creditos: number;
  correlativas: string[];
  categoria: string;
  nivel: number | null;
  requiereCreditos?: number;
};

export const CARRERAS = indexJson as Carrera[];

const loaders = import.meta.glob<Materia[]>(["../data/planes/*.json", "!../data/planes/index.json"], { import: "default" });
const cache = new Map<string, Materia[]>();

export function findPlan(planId: string | null): { carrera: Carrera; plan: PlanMeta } | null {
  if (!planId) return null;
  for (const c of CARRERAS) {
    const plan = c.planes.find((p) => p.id === planId);
    if (plan) return { carrera: c, plan };
  }
  return null;
}

export function planLabel(p: PlanMeta): string {
  return p.ano >= 2020 ? "Plan 2020 (vigente)" : `Plan ${p.ano}`;
}

export async function loadPlan(planId: string): Promise<Materia[]> {
  if (cache.has(planId)) return cache.get(planId)!;
  const loader = loaders[`../data/planes/${planId}.json`];
  if (!loader) throw new Error(`No existe el plan ${planId}`);
  const materias = (await loader()).filter((m) => m.id !== "CBC");
  cache.set(planId, materias);
  return materias;
}

export function usePlan(planId: string | null): Materia[] | null {
  const [m, setM] = useState<Materia[] | null>(planId ? cache.get(planId) ?? null : null);
  useEffect(() => {
    if (!planId) { setM(null); return; }
    let alive = true;
    loadPlan(planId).then((x) => alive && setM(x)).catch(() => alive && setM([]));
    return () => { alive = false; };
  }, [planId]);
  return m;
}

export const isCbc = (m: Materia) => m.categoria === "*CBC";

export type Section = { key: string; title: string; materias: Materia[] };

export function sections(materias: Materia[]): Section[] {
  const out: Section[] = [];
  const cbc = materias.filter(isCbc);
  if (cbc.length) out.push({ key: "cbc", title: "Ciclo Básico Común", materias: cbc });
  const levels = [...new Set(materias.filter((m) => !isCbc(m) && m.nivel !== null && m.nivel > 0).map((m) => m.nivel!))].sort((a, b) => a - b);
  for (const l of levels) {
    out.push({ key: `n${l}`, title: `${l}.º cuatrimestre`, materias: materias.filter((m) => !isCbc(m) && m.nivel === l) });
  }
  const rest = materias.filter((m) => !isCbc(m) && (m.nivel === null || m.nivel <= 0));
  const groups = [...new Set(rest.map((m) => m.categoria))];
  for (const g of groups) {
    out.push({ key: g, title: g.replace(" (Obligatorio)", ""), materias: rest.filter((m) => m.categoria === g) });
  }
  return out;
}

export type StatusMap = Map<string, SubjectState>;

export function statusMap(statuses: SubjectStatus[], userId: string, planId: string): StatusMap {
  return new Map(statuses.filter((s) => s.userId === userId && s.planId === planId).map((s) => [s.subjectId, s.status]));
}

const RANK: Record<SubjectState, number> = { cursando: 1, regularizada: 2, aprobada: 3 };

export function creditosAprobados(materias: Materia[], st: StatusMap): number {
  return materias.filter((m) => !isCbc(m) && st.get(m.id) === "aprobada").reduce((a, m) => a + m.creditos, 0);
}

/**
 * Regla para "podés cursarla": todas las correlativas con la cursada aprobada (regularizadas o aprobadas)
 * y los créditos mínimos que pida la materia. Si la facultad exige otra cosa, cambiar MINIMO_CORRELATIVA.
 */
export const MINIMO_CORRELATIVA: SubjectState = "regularizada";

export function correlativaOk(id: string, materias: Materia[], st: StatusMap): boolean {
  if (id === "CBC") return materias.filter(isCbc).every((m) => st.get(m.id) === "aprobada");
  const s = st.get(id);
  return !!s && RANK[s] >= RANK[MINIMO_CORRELATIVA];
}

export function habilitada(m: Materia, materias: Materia[], st: StatusMap): boolean {
  if (isCbc(m)) return true;
  if (!m.correlativas.every((c) => correlativaOk(c, materias, st))) return false;
  if (m.requiereCreditos && creditosAprobados(materias, st) < m.requiereCreditos) return false;
  return true;
}

export function habilitaA(m: Materia, materias: Materia[]): Materia[] {
  const ids = isCbc(m) ? [m.id, "CBC"] : [m.id];
  return materias.filter((x) => x.correlativas.some((c) => ids.includes(c)));
}

export function materiaNombre(materias: Materia[], id: string): string {
  if (id === "CBC") return "CBC completo";
  return materias.find((m) => m.id === id)?.nombre ?? id;
}
