// G05 — find Qloo entities for the 16 curated landmarks and print a review table.
// Requires Node >= 23.6 (type stripping is on by default) or Node 22.6+ with
// `--experimental-strip-types`, because it imports the TypeScript landmark list.
//   node --env-file=.env.local scripts/qloo-map-landmarks.mjs
import { qlooGet, resultArray, compact, printTable } from "./_qloo.mjs";
import { ISTANBUL_LANDMARKS } from "../src/lib/istanbul-landmarks.ts";

const rows = [];
for (const lm of ISTANBUL_LANDMARKS) {
  const r = await qlooGet("/search", { query: `${lm.title} Istanbul`, take: 3 });
  if (r.status !== 200) {
    rows.push({ id: lm.id, title: lm.title, status: r.status });
    continue;
  }
  const candidates = resultArray(r.json).slice(0, 3).map(compact);
  if (candidates.length === 0) rows.push({ id: lm.id, title: lm.title, candidate: "(none)" });
  for (const [i, c] of candidates.entries()) {
    rows.push({
      id: i === 0 ? lm.id : "",
      title: i === 0 ? lm.title : "",
      rank: i + 1,
      candidate: c.name,
      entity_id: c.entity_id,
      types: (c.types ?? []).join(" "),
      popularity: c.popularity,
    });
  }
}
printTable(rows);
console.log(
  "\nReview the table, then set `qloo.entityId` + `confidence` in src/lib/istanbul-landmarks.ts.",
);
console.log("Only `exact`/`likely` matches get a Qloo badge; leave ambiguous ones as `none`.");
