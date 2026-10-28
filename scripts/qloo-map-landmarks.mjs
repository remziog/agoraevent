// Preview Qloo place candidates for the 16 curated landmarks (local, read-only).
//
// The app maps landmarks on its own at runtime and caches the result in the
// landmark_qloo_map table (see src/lib/qloo-landmarks.server.ts and the
// /app/qloo-status page). This script only prints what /search returns for each
// alias so the matching rule can be reviewed; it writes nothing, and its output
// (Qloo data) must not be committed.
//
// Requires Node >= 23.6 (type stripping is on by default) or Node 22.6+ with
// `--experimental-strip-types`, because it imports the TypeScript landmark list.
//   node --env-file=.env.local scripts/qloo-map-landmarks.mjs
import { qlooGet, resultArray, compact, printTable } from "./_qloo.mjs";
import { ISTANBUL_LANDMARKS } from "../src/lib/istanbul-landmarks.ts";

const rows = [];
for (const lm of ISTANBUL_LANDMARKS) {
  for (const query of lm.aliases.slice(0, 2)) {
    const r = await qlooGet("/search", { query, types: "urn:entity:place", take: 3 });
    if (r.status !== 200) {
      rows.push({ id: lm.id, query, status: r.status });
      continue;
    }
    const candidates = resultArray(r.json).slice(0, 3).map(compact);
    if (candidates.length === 0) rows.push({ id: lm.id, query, candidate: "(none)" });
    for (const [i, c] of candidates.entries()) {
      rows.push({
        id: i === 0 ? lm.id : "",
        query: i === 0 ? query : "",
        rank: i + 1,
        candidate: c.name,
        address: c.address,
        popularity: c.popularity,
      });
    }
  }
}
printTable(rows);
