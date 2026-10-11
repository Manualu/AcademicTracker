// Genera supabase/functions/_shared/pieces.ts con el nombre de cada pieza ("un motor trifásico IE3"),
// para que los avisos push digan qué pieza fabricó cada uno. Correr después de tocar el catálogo:
//   node scripts/build-piece-names.mjs
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

globalThis.window = { matchMedia: () => ({ matches: false }) };
const dir = mkdtempSync(join(tmpdir(), "piezas-"));
const out = join(dir, "catalog.mjs");
await build({ entryPoints: ["src/lib/catalog.ts"], bundle: true, format: "esm", outfile: out, logLevel: "warning" });
const { ALL_PIECES, pieceArticle, pieceDef } = await import(out);
const names = Object.fromEntries(ALL_PIECES.map((p) => [p.id, pieceArticle(p.id)]));
names.tornillo = pieceArticle("tornillo");
const rarity = Object.fromEntries(ALL_PIECES.map((p) => [p.id, pieceDef(p.id).r]));
writeFileSync("supabase/functions/_shared/pieces.ts",
  `// Generado por scripts/build-piece-names.mjs a partir del catálogo de la app. No editar a mano.\n` +
  `export const PIECE_NAMES: Record<string, string> = ${JSON.stringify(names, null, 2)};\n\n` +
  `export const PIECE_RARITY: Record<string, string> = ${JSON.stringify(rarity, null, 2)};\n`);
console.log(Object.keys(names).length, "piezas");
