# Agora × Qloo Agentic Hackathon — integration notes

Branch: `hackathon/qloo-agent` (rebased on `main` after PRs #1–#3, 25 Oct 2026). `main` is only changed through pull requests; Lovable publishes from `main`.

Submission deadline: 30 Oct 2026 23:45 EDT (31 Oct 06:45 Istanbul). Working plan and task notes live in Remzi's Obsidian vault / claude.ai project; this file is the repo-side summary.

## What Agora became for the hackathon

A taste-aware Istanbul compass. One conversation on the compass (`/app` → `/app/map`): say or type what you want — or pick a category and a district — and the `discover()` server function reads the intent (restaurant, place or gathering) and the conditions, verifies favourites with Qloo's typed `/search`, asks one question when it must, ranks real places in the district with `/v2/insights` (favourites as `signal.interests.entities`, explainability on) and adds Agora's own gatherings in the same window, labelled as Agora data. The **Taste guide** below is the deeper landmark mode. Save vs. RSVP, My plans, My communities, Add to calendar and Bingo (self-reported "I went here" records on the device) complete the loop. Design: Naz Paşalı.

| Surface               | What shipped                                                                                                   | Qloo / AI                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Compass               | Free text, voice or category + district → one clarifying question at most → Qloo-ranked places or Agora gatherings, with the discovery dial and "How Agora decided" | `/search` (typed) to verify favourites, `/v2/tags` for place-scoped tags, `/v2/insights` to rank            |
| Taste guide           | Three favourites → confirm → agent → 3 landmarks with Qloo's evidence, stories (History / Legend, narration)    | `/v2/insights` with `filter.results.entities` (landmark shortlist); Vercel AI SDK `ToolLoopAgent`                    |
| Restaurants and places | Ranked for the user's taste in the district, with "Why it fits you"                                           | `/v2/insights` with `filter.type=urn:entity:place`, `filter.tags`, `filter.exclude.tags`, `filter.location.query`, `feature.explainability` |
| Gatherings            | Agora's own community events in the same district and window                                                   | Agora data only — no Qloo badge                                                                                      |

Not built: AI-generated story videos (the landmark story has no video; it is text with narration).

## The guide (`/app/guide`, "Taste guide" in the member nav)

1. **Favourites** — a musician or band, a film or series, a book or author, plus an optional mood. Only these words go to Qloo.
2. **Confirm** — `/search` candidates per favourite ("Is this who you mean?"); the person confirms or skips each one (kit rule: uncertain matches are confirmed, never assumed).
3. **Plan** — the agent runs (below): three landmark cards (Qloo rank, favourites credited by Qloo's explainability, the agent's one-sentence note labelled "Agora's note · AI", the story section it chose), Qloo-ranked restaurants near the first pick ("Eat nearby, matched to you"), Agora gatherings within 3 km this week (seeded demo events marked "Sample"), and **How Agora decided** — every tool call and every Qloo request with parameters, status and timing.
4. **Story** — the landmark drawer tells the story in labelled History / Legend sections with "Listen" narration (browser speech synthesis), opening on the agent's chosen section.

### The agent

`src/lib/guide-agent.server.ts` — a Vercel AI SDK v6 `ToolLoopAgent` on the Lovable AI gateway (model list tried in order: `google/gemini-3-flash-preview`, then `google/gemini-2.5-flash`), stopping on `submit_plan` or after 10 steps, with five tools:

| Tool               | What it does                                                                                                                                                                                                                                  | Source                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `rank_landmarks`   | Landmark map (`landmark_qloo_map`) → `/v2/insights` with `filter.results.entities` (our shortlist), `signal.interests.entities` (the confirmed favourites), `feature.explainability=true` — the call the official harness's `qloo_rank` makes | Qloo                     |
| `story_outline`    | History / Legend section titles available for a landmark                                                                                                                                                                                      | Agora content            |
| `restaurants_near` | `/v2/insights`, `filter.type=urn:entity:place`, `filter.tags=<restaurant tag>`, `filter.location.query="<district>, Istanbul"`, same favourites, explainability on                                                                            | Qloo                     |
| `gatherings_near`  | Agora gatherings within 3 km of the landmark in the next 7 days                                                                                                                                                                               | Agora DB (no Qloo badge) |
| `submit_plan`      | The agent's picks (among Qloo's top 6), the story section to open with, one-sentence hooks and a summary                                                                                                                                      | —                        |

Every fact shown comes from tool executions recorded on the server; the model only chooses tools, picks among Qloo's results and writes the notes. Invalid picks are dropped and Qloo's order fills the gaps. **Fallback:** without `LOVABLE_API_KEY`, when the agent fails or never submits, the same tools run in a fixed order (`mode: "fixed"`) and the plan carries a `notice` saying so. Credited favourites come from `explainDrivers` (qloo.schemas.ts), which walks `query.explainability` for the confirmed entity ids and never names a favourite Qloo did not credit.

## Qloo client

- `src/lib/qloo.server.ts` — server-only transport (`X-Api-Key` header, 10 s timeout, one bounded retry on 429) and typed wrappers: `qlooSearch`, `qlooRankShortlist` (`/v2/insights` + `filter.results.entities`, what the official harness's `qloo_rank` does), `qlooPlacesNear`, `qlooFindTags`. Every call can append a redacted entry to a trace.
- `src/lib/qloo.schemas.ts` — lenient response schemas and the normalised `QlooEntity` type (safe for the client bundle).
- `src/lib/guide-agent.server.ts` / `src/lib/guide.functions.ts` (`planVisit`) — the agent and its server function; `src/lib/guide.types.ts` — client-safe types (`GuidePlan`, `GuidePick`, `GuideTraceStep`…).
- `src/routes/_authenticated/app.guide.tsx`, `src/components/guide/*` (`GuideResults`, `GuideTrace`, `guide-format`), `src/components/LandmarkStory.tsx` — the screen, the results, the trace panel and the narrated story (also used by the landmark drawer).
- `src/lib/qloo.functions.ts` — server functions behind Supabase auth: `resolveTaste`, `recommendPlaces`, `findRestaurantsNearby`. Each returns `{ ok, data | error, calls }` so the UI can show provenance or degrade honestly.
- `src/lib/istanbul-landmarks.ts` — each landmark carries `district` (sent to Qloo as `"<district>, Istanbul"`) and `aliases` (English and Turkish names used for Qloo `/search`).
- `src/lib/qloo-landmarks.server.ts` — maps landmarks to Qloo place entities at runtime: a candidate is accepted only if its name matches an alias and Qloo locates it in Istanbul. The outcome (including "no match") is cached in the `landmark_qloo_map` table (RLS on, server only), so Qloo identifiers and responses never live in this repository. Unmatched landmarks never get a Qloo badge.
- `/app/qloo-status` (signed-in, not linked) — live diagnostics: credential present, first `/search`, landmark map with candidates, one-taste ranking with raw explainability, restaurant coverage per district.

Configuration (server only — see `.env.example`):

- `QLOO_API_KEY` — the event credential. Lovable secret in production, `.env.local` locally. Never `VITE_`-prefixed, never committed, never in screenshots.
- `QLOO_BASE_URL` — defaults to `https://api.qloo.com` (same host the `@qloo/qloo-harness` uses). The legacy `QLOO_API_BASE_URL` is still read as a fallback. Hackathon credentials may be provisioned only on `https://hackathon.api.qloo.com` (first live call on 28 Oct 2026: 401 on `api.qloo.com`): the transport retries an auth failure once on the other known host, remembers the host that accepted the key, and `/app/qloo-status` says which one answered. Set `QLOO_BASE_URL` to the host named in the key email to skip the failed first try.
- `QLOO_RESTAURANT_TAGS` — optional comma-separated tag ids to pin the restaurant filter; otherwise discovered at runtime via `/v2/tags`.

Probe scripts (Node ≥ 22, no dependencies, key from `.env.local`):

```bash
node --env-file=.env.local scripts/qloo-smoke.mjs              # first call: host + credential check
node --env-file=.env.local scripts/qloo-map-landmarks.mjs      # preview /search candidates per landmark alias (prints only)
node --env-file=.env.local scripts/qloo-restaurants-probe.mjs  # restaurant coverage per neighbourhood
```

Checks (no key needed):

```bash
npx tsc --noEmit                                 # types
npx vite build                                   # client + worker bundles (the client bundle never contains X-Api-Key)
node --test tests/qloo-schemas.test.mjs          # explainDrivers, boundJson, normalizeEntity, result envelopes
npx tsx --test tests/guide-agent.offline.test.ts # the agent's fixed plan end to end with a mocked Qloo API + mocked landmark_qloo_map
```

Still to verify with the live credential: the exact `query.explainability` shape (`explainDrivers` is structure-agnostic; `/app/qloo-status` shows the raw payload), whether the gateway runs tools for the listed models (the fixed plan covers "no"), how many landmarks map, and Qloo's restaurant coverage per district. The `landmark_qloo_map` migration must be applied in Lovable Cloud before the guide runs in production. The Devpost write-up is `docs/devpost.md`.

Reference while building: the Qloo docs MCP server (`https://docs.qloo.com/mcp`, no credential, read-only) — `claude mcp add --transport http qloo-docs https://docs.qloo.com/mcp`.

## Architecture note: Workers vs. the harness

Agora's server functions run on Cloudflare Workers. The hackathon kit lists `qloo explore/exec/api/mcp` from `@qloo/qloo-harness` as the supported surfaces and says serverless functions are not a supported route and a browser cannot start `qloo mcp`. Agora therefore calls the same HTTP endpoints the harness wraps (`/search`, `/v2/insights`, `/v2/tags`) directly from the worker with the event credential. The first live call decides: if the credential works against `api.qloo.com` from the worker runtime we stay with direct HTTP (plan A); if not, a small Node service running the harness sits between the worker and Qloo (plan B).

## Coordination (two Claude sessions on this branch, 28 Oct)

Two sessions were committing to `hackathon/qloo-agent` on 28 Oct and both merge to `main` through PRs. To avoid stepping on each other:

- **Session `01P8W87q…` (Remzi's chat "Hackathon analizi durumu"):** live verification on the Lovable preview and ago-ra.life (Qloo credential, landmark map, agent, the `/app/guide` flow), fixes found by live testing, deploys. Owns `src/lib/guide-agent.server.ts`, `src/lib/qloo*.ts`, `src/routes/_authenticated/app.guide.tsx`, `src/components/guide/*` and `src/routes/api/guide-health.ts` until the live test is done.
- **Session `0148Wf1W…`:** offline tests (`tests/`), `docs/devpost.md`, README, this file's other sections.

Always `git fetch` and rebase before pushing; open a PR rather than pushing to `main`. Status of the live test is tracked in GitHub issue "Live verification of the taste guide".

## Operator health check

`GET/POST /api/guide-health` exists only when `GUIDE_HEALTH_TOKEN` (≥ 16 chars) is set in the server environment and the caller sends it as `Authorization: Bearer …`; otherwise the route answers 404. `GET ?map=1` checks the credential, runs one `/search`, and fills/reads the landmark map; `POST {"terms": [...], "mood": "..."}` resolves the terms and runs the agent, returning the full plan and trace. It is for verifying a deployment; the production secret should stay unset once the live test is done.

## Rules we follow

- Never present a non-Qloo result as Qloo-powered; landmarks without a confident Qloo entity never get a Qloo badge; events are Agora data.
- Only taste terms, Qloo entity ids, tag ids and a neighbourhood name are sent to Qloo — no names, emails, user ids or GPS positions.
- Ambiguous entity matches are shown to the user for confirmation before they are used as signals.
- Qloo results are aggregate affinities, not evidence about an individual; the UI says "ranked by Qloo for your taste", not "you will like this".
- Legend sections are labelled as legend; AI notes are labelled "AI".

## About `.env`

The tracked `.env` is managed by Lovable Cloud and contains only publishable client values (`VITE_*`, Supabase publishable key, Maps browser key — all already visible in the site's JS bundle). Lovable's Vite config reads it at build time, so **do not delete, untrack or rewrite it**. Server secrets go to Lovable secrets in production and to the git-ignored `.env.local` locally. A history scan on 18 Oct 2026 found no service-role keys, tokens or private keys in any branch.
