# Agora × Qloo Agentic Hackathon — integration notes

Branch: `hackathon/qloo-agent` (rebased on `main` after PRs #1–#3, 25 Oct 2026). `main` is only changed through pull requests; Lovable publishes from `main`.

Submission deadline: 30 Oct 2026 23:45 EDT (31 Oct 06:45 Istanbul). Working plan and task notes live in Remzi's Obsidian vault / claude.ai project; this file is the repo-side summary.

## What Agora is becoming for the hackathon

A taste-aware Istanbul companion: tell it what you love (artists, films, books) and an agent uses Qloo's taste graph to pick the historic places, nearby restaurants and gatherings you'll connect with — then tells each place's story (short pre-made AI film or narrated photo story), keeping history and legend clearly apart.

Four surfaces, each in its thinnest viable slice:

| Surface | Slice | Qloo / AI |
| --- | --- | --- |
| Compass search | Taste form (3 fields) → agent → 3 landmarks; free-text input if time allows | `/search` to resolve terms, `/v2/insights` to rank |
| Place history as a short AI video | 3 hero landmarks with pre-generated 30–45 s clips + History/Legend captions; narrated photo story for the rest | Veo 3.1 via the Lovable AI gateway (or an external tool), TTS |
| Restaurant experience | 3 restaurants in the landmark's neighbourhood, ranked for the user's taste, with "why" | `/v2/insights` with `filter.type=urn:entity:place`, `filter.tags`, `filter.location.query`, `feature.explainability` |
| Events | Agora's own community events near the landmark in the next 7 days | Agora data only — no Qloo badge |

## Qloo client

- `src/lib/qloo.server.ts` — server-only transport (`X-Api-Key` header, 10 s timeout, one bounded retry on 429) and typed wrappers: `qlooSearch`, `qlooRankShortlist` (`/v2/insights` + `filter.results.entities`, what the official harness's `qloo_rank` does), `qlooPlacesNear`, `qlooFindTags`. Every call can append a redacted entry to a trace.
- `src/lib/qloo.schemas.ts` — lenient response schemas and the normalised `QlooEntity` type (safe for the client bundle).
- `src/lib/qloo.functions.ts` — server functions behind Supabase auth: `resolveTaste`, `recommendPlaces`, `findRestaurantsNearby`. Each returns `{ ok, data | error, calls }` so the UI can show provenance or degrade honestly.
- `src/lib/istanbul-landmarks.ts` — each landmark carries `district` (sent to Qloo as `"<district>, Istanbul"`) and `aliases` (English and Turkish names used for Qloo `/search`).
- `src/lib/qloo-landmarks.server.ts` — maps landmarks to Qloo place entities at runtime: a candidate is accepted only if its name matches an alias and Qloo locates it in Istanbul. The outcome (including "no match") is cached in the `landmark_qloo_map` table (RLS on, server only), so Qloo identifiers and responses never live in this repository. Unmatched landmarks never get a Qloo badge.
- `/app/qloo-status` (signed-in, not linked) — live diagnostics: credential present, first `/search`, landmark map with candidates, one-taste ranking with raw explainability, restaurant coverage per district.

Configuration (server only — see `.env.example`):

- `QLOO_API_KEY` — the event credential. Lovable secret in production, `.env.local` locally. Never `VITE_`-prefixed, never committed, never in screenshots.
- `QLOO_BASE_URL` — defaults to `https://api.qloo.com` (same host the `@qloo/qloo-harness` uses). The legacy `QLOO_API_BASE_URL` is still read as a fallback.
- `QLOO_RESTAURANT_TAGS` — optional comma-separated tag ids to pin the restaurant filter; otherwise discovered at runtime via `/v2/tags`.

Probe scripts (Node ≥ 22, no dependencies, key from `.env.local`):

```bash
node --env-file=.env.local scripts/qloo-smoke.mjs              # first call: host + credential check
node --env-file=.env.local scripts/qloo-map-landmarks.mjs      # preview /search candidates per landmark alias (prints only)
node --env-file=.env.local scripts/qloo-restaurants-probe.mjs  # restaurant coverage per neighbourhood
```

Reference while building: the Qloo docs MCP server (`https://docs.qloo.com/mcp`, no credential, read-only) — `claude mcp add --transport http qloo-docs https://docs.qloo.com/mcp`.

## Architecture note: Workers vs. the harness

Agora's server functions run on Cloudflare Workers. The hackathon kit lists `qloo explore/exec/api/mcp` from `@qloo/qloo-harness` as the supported surfaces and says serverless functions are not a supported route and a browser cannot start `qloo mcp`. Agora therefore calls the same HTTP endpoints the harness wraps (`/search`, `/v2/insights`, `/v2/tags`) directly from the worker with the event credential. The first live call decides: if the credential works against `api.qloo.com` from the worker runtime we stay with direct HTTP (plan A); if not, a small Node service running the harness sits between the worker and Qloo (plan B).

## Rules we follow

- Never present a non-Qloo result as Qloo-powered; landmarks without a confident Qloo entity never get a Qloo badge; events are Agora data.
- Only taste terms, Qloo entity ids, tag ids and a neighbourhood name are sent to Qloo — no names, emails, user ids or GPS positions.
- Ambiguous entity matches are shown to the user for confirmation before they are used as signals.
- Qloo results are aggregate affinities, not evidence about an individual; the UI says "ranked by Qloo for your taste", not "you will like this".
- Pre-made videos are labelled as AI-generated visualisations; legend sections are labelled as legend.

## About `.env`

The tracked `.env` is managed by Lovable Cloud and contains only publishable client values (`VITE_*`, Supabase publishable key, Maps browser key — all already visible in the site's JS bundle). Lovable's Vite config reads it at build time, so **do not delete, untrack or rewrite it**. Server secrets go to Lovable secrets in production and to the git-ignored `.env.local` locally. A history scan on 18 Oct 2026 found no service-role keys, tokens or private keys in any branch.
