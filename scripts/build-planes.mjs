// Convierte los planes de FIUBA-Map (MIT, github.com/fdelmazo/FIUBA-Map) al formato de la app.
// Uso: node scripts/build-planes.mjs <ruta-a-FIUBA-Map>
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) { console.error("Pasá la ruta al repo clonado de FIUBA-Map"); process.exit(1); }
const carrerasTs = fs.readFileSync(path.join(src, "src/carreras.ts"), "utf8");

// Metadatos de cada plan: id, año, archivo de materias, créditos totales y de electivas
const planesMeta = {};
const blocks = carrerasTs.split(/\n  \{\n    id: "/).slice(1);
for (const b of blocks) {
  const id = b.slice(0, b.indexOf('"'));
  const ano = Number(/ano: (\d+)/.exec(b)?.[1]);
  const file = /require\("\.\/data\/([^"]+)"\)/.exec(b)?.[1];
  const total = Number(/total: (\d+)/.exec(b)?.[1] ?? 0);
  const elect = /electivas: (\d+)/.exec(b)?.[1];
  if (file) planesMeta[id] = { id, ano, file, creditosTotal: total, creditosElectivas: elect ? Number(elect) : null };
}

// Agrupación por carrera, tal como la presenta FIUBA-Map
const planesTxt = carrerasTs.slice(carrerasTs.indexOf("export const PLANES"));
const carreras = [];
for (const m of planesTxt.matchAll(/nombre: "([^"]+)",\s*nombrecorto: "([^"]+)",\s*planes: \[([^\]]+)\]/g)) {
  const ids = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  carreras.push({ nombre: m[1], nombreCorto: m[2], planes: ids.map((id) => planesMeta[id]).filter(Boolean)
    .map(({ id, ano, creditosTotal, creditosElectivas }) => ({ id, ano, creditosTotal, creditosElectivas })) });
}

const outDir = path.resolve("src/data/planes");
fs.mkdirSync(outDir, { recursive: true });
for (const meta of Object.values(planesMeta)) {
  const raw = JSON.parse(fs.readFileSync(path.join(src, "src/data", meta.file), "utf8"));
  const materias = raw.map((m) => ({
    id: m.id,
    nombre: m.materia,
    creditos: m.creditos ?? 0,
    correlativas: m.correlativas ? m.correlativas.split("-").filter(Boolean) : [],
    categoria: m.categoria,
    nivel: m.level ?? null,
    ...(m.requiere ? { requiereCreditos: m.requiere } : {}),
  }));
  fs.writeFileSync(path.join(outDir, `${meta.id}.json`), JSON.stringify(materias));
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(carreras, null, 1));
console.log(`${carreras.length} carreras, ${Object.keys(planesMeta).length} planes`);
