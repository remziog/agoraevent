// G03 — first Qloo call. Prints only HTTP status + top 3 results; never the key.
//   node --env-file=.env.local scripts/qloo-smoke.mjs ["Basilica Cistern"]
import { BASE_URL, qlooGet, resultArray, compact, printTable } from "./_qloo.mjs";

const query = process.argv[2] ?? "Basilica Cistern";
console.log(`Qloo base URL: ${BASE_URL}`);
const r = await qlooGet("/search", { query, take: 3 });
console.log(`GET ${r.url}`);
console.log(`HTTP ${r.status} in ${r.ms} ms`);
if (r.status === 401 || r.status === 403) {
  console.log(
    "Credential rejected on this host. Try QLOO_BASE_URL=https://hackathon.api.qloo.com (2025 host) before falling back to a Node service (plan B).",
  );
  process.exit(1);
}
if (r.status === 429) {
  console.log(
    "Rate limited / quota. Wait and retry once; note the Retry-After header in the Oturum Günlüğü.",
  );
  process.exit(1);
}
if (!r.json) {
  console.log("Non-JSON body:", r.text);
  process.exit(1);
}
const rows = resultArray(r.json).slice(0, 3).map(compact);
printTable(rows);
console.log(
  rows.length > 0
    ? "OK — plan A (direct HTTP from the worker) is viable; record host + decision in Qloo Hackathon.md §2/§5."
    : "200 but no results — check the query/host.",
);
