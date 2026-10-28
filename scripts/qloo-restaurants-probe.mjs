// G16 step 1 — does Qloo have restaurant coverage for Istanbul neighbourhoods?
//   node --env-file=.env.local scripts/qloo-restaurants-probe.mjs
import { qlooGet, resultArray, compact, printTable } from "./_qloo.mjs";

console.log("1) Restaurant tags via /v2/tags (semantic search)");
const tagsRes = await qlooGet("/v2/tags", {
  "filter.query": "restaurant",
  "feature.semantic_search": true,
  take: 8,
});
console.log(`HTTP ${tagsRes.status} in ${tagsRes.ms} ms`);
const tags = resultArray(tagsRes.json, "tags").map((t) => ({
  id: t.id ?? t.tag_id,
  name: t.name,
  type: t.type ?? t.subtype,
}));
printTable(tags);
const restaurantTag = tags.find((t) => /restaurant/i.test(t.name ?? ""))?.id;
console.log(
  restaurantTag
    ? `Using tag: ${restaurantTag} (set QLOO_RESTAURANT_TAGS to pin it)`
    : "No restaurant tag found — probing without filter.tags",
);

const districts = ["Sultanahmet, Istanbul", "Karaköy, Istanbul", "Kadıköy, Istanbul"];
for (const district of districts) {
  console.log(`\n2) Places in ${district}`);
  const params = {
    "filter.type": "urn:entity:place",
    "filter.location.query": district,
    "feature.explainability": true,
    take: 10,
  };
  if (restaurantTag) params["filter.tags"] = restaurantTag;
  const r = await qlooGet("/v2/insights", params);
  console.log(`HTTP ${r.status} in ${r.ms} ms — ${r.url}`);
  if (r.status !== 200) {
    console.log(r.text);
    continue;
  }
  const places = resultArray(r.json).map(compact);
  printTable(places);
  const withProps = places.filter(
    (p) => p.address || p.price_level !== undefined || p.business_rating !== undefined,
  ).length;
  console.log(`${places.length} results, ${withProps} with address/price/rating`);
}
console.log(
  '\nIf coverage is thin: try filter.location.query="Istanbul" and filter by distance using properties.geocode, or check the docs MCP for filter.location (WKT) + filter.location.radius.',
);
