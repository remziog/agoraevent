# Agora x Qloo — Hackathon integration notes

Branch: `hackathon/qloo-agent`. Keep `main` untouched.

## Existing product
Agora is a TanStack Start + React + Supabase events discovery app. It already contains Istanbul landmarks, a map/details drawer, taste profiles, and server-side AI recommendations.

## Minimum MVP
1. Discover: reuse the Istanbul landmark catalog and map.
2. Experience: add an accessible audio story control to landmark details, with pre-authored factual stories and curated imagery.
3. Next discovery: enrich user tastes through real Qloo API results, then show an explainable recommendation.

## Qloo client
`src/lib/qloo.server.ts` is a **server-only HTTP transport**, not yet a working Qloo recommendation feature.
Configure `QLOO_API_KEY` as a server secret. Optional `QLOO_API_BASE_URL` overrides the default hackathon endpoint.
Verify the current Qloo developer documentation for endpoint paths, query parameters, rate limits, and eligibility before calling `qlooGet`.
Do not put API keys into client bundles, screenshots, documentation, or Git commits.
Never present mocked recommendations as Qloo-powered.

## Next implementation steps
- Confirm actual Qloo credentials and make a minimal authenticated API test.
- Define a validated response schema and map Qloo entities to Agora cultural destinations.
- Add a server function with input validation, rate limiting, and clear API failure states.
- Wire a UI to that server function; display actual Qloo-supported evidence in recommendations.
- Implement audio narration (browser speech synthesis as a low-cost first pass).
- Run build, tests, and manual mobile demo checks before submission.

## Security warning
The existing repository tracks a `.env` file. **Do not copy its values into reports.** Audit it privately, rotate any exposed credentials, remove tracked secrets from the repository, and consider history cleanup if real secrets were committed. A private repo is not a safe secrets store.
