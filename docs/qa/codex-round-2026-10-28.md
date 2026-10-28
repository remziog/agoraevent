# Agora — handover for the independent test round (Codex)

28 Oct 2026, evening · written by the implementation session (Claude).

## What to test

| | |
|---|---|
| Repository / branch | `remziog/agoraevent`, `main` = merge of PR #10 (`7a41664`); `hackathon/qloo-agent` fast-forwarded to the same commit |
| Live build | https://ago-ra.life (Lovable Publish of `main`; the deployment id and time are in the chat handover) |
| Test account | the same signed-in account used in the 28 Oct rounds (nothing new is needed) |
| Local run | `bash scripts/install-outside-lovable.sh` · `cp .env.example .env.local` · `bun run dev` (server secrets needed for Qloo/AI; the UI runs without them and says so) |
| Checks that pass locally | `npx tsc --noEmit` · `npx vite build` · `node --test tests/qloo-schemas.test.mjs` (9) · `node --test tests/discovery.test.mjs` (7) · `npx tsx --test tests/guide-agent.offline.test.ts` (6) |

## Finding → status

| Finding | Root cause (verified in code) | Fix | Status |
|---|---|---|---|
| F-01 TOP MATCH for a non-matching alternative | search extracted only interest tags; results list was `[matches, other upcoming, landmarks]` and the map labelled `events[0]` "Top match" | explicit constraints (date window in Istanbul time, district, budget, group size, meeting people, tags) → hard filters → *meets every condition* vs. *alternatives, each labelled with what it misses*; unknown price/capacity never counts as satisfied | fixed, awaiting live re-test |
| F-02 Qloo guide ends with 0 places | `/v2/insights` 200 but one odd item made the strict array parse reject the whole answer → `[]` silently (the trace showed no result count) | per-item tolerant parsing; counts upstream / parsed / unreadable / in-shortlist on every call, visible in "How Agora decided"; editorial fallback (labelled, no Qloo badge) + Qloo restaurants + city-wide gatherings when Qloo truly ranks nothing | fixed; **the first live run after deploy is the proof — see scenario 2** |
| F-03 "agent wasn't available" vs "agent finished in 2 steps" | the panel text was keyed on `mode === "fixed"` only | single `execution` status drives badge, notice and panel text | fixed |
| F-04 irrelevant candidate kinds | `/search` without `types` | typed search per field first (artist / movie+tv_show / book+author), other kinds in a collapsed "Other kinds" group | fixed |
| F-05 calendar transient empty/stale | `isLoading` rendered the empty state; RSVP invalidation ran in the background | loading skeleton, "refreshing" indicator, the RSVP button stays busy until event/calendar/stats/community queries are refreshed (`refetchType: "all"`), calendar refetches on every mount | fixed |
| AG-02 Ortaköy → Silivri EXACT | "in Istanbul" check only looked for `istanbul` in the address text | same-place rule: Qloo coordinates within 2.5 km of the pin (6 km for areas), else the address must name the landmark's own neighbourhood; one-word aliases exact only; areas exact only; cached rows re-resolved under rules version 2 | fixed; the table row is replaced on the next guide run or "Look up unmapped landmarks" |
| AG-03 calendar stale after cancel | see F-05 | see F-05 | fixed |
| AG-05 restaurants 0 in Sultanahmet | not changed (needs live coverage data) | — | open, P2 |
| AG-06 / UI-03 candidate selection a11y | buttons without state | native radio groups (`<input type="radio">` per option incl. "skip"), arrow keys move selection, group labelled by the term | fixed |
| UI-01 Turkish | guide/app strings were hard-coded | discover, results, event, community, calendar, header, story and guide strings through i18n with Turkish; DE/RU fall back to English for the new strings | fixed for the new screens; `/app/profile`, `/app/memories`, `/biz/*` still English |
| UI-02 mobile language switcher | absent from the drawer | in the mobile menu | fixed |
| UI-04 "three things" wording | copy | "one to three" | fixed |
| UI-05 empty header | copy keyed on step | all-empty answer gets "We couldn't match these." + edit/example actions | fixed |

## Safe scenarios (no real notifications, no payments, no bulk data changes)

1. **Compass without typing** — /app → "Quiet & intimate" → results page opens with the conversation, condition chips (window assumed: next 7 days) and real listings; "Event details" → "I'm going" → confirmation dialog → confirm → "See it in your calendar" → calendar shows it at once → event → "You're going — cancel?" → confirm cancel → calendar shows it gone without a reload. Only the demo listings (badge "Demo") should be used.
2. **Qloo guide example** — /app/guide → "Use an example" → "Find my Istanbul" → candidates: Nick Cave as *Artist* only (Author/Person under "Other kinds"), Amélie as *Film* (album/place under "Other kinds") → "Plan my visit". Expected now: either Qloo-ranked landmark cards (badge "Qloo #n for your taste") **or** the honest editorial fallback with the notice. Open "How Agora decided": the `/v2/insights` line must now read `→ N upstream · M parsed · K in shortlist`. **Report those three numbers** — they settle whether Qloo really ranks nothing or the parse fix did it.
3. **F-01** — /app → type `Bu akşam Kadıköy'de, en fazla 700 TL, küçük bir grupta elektronik müzik dinleyip yeni insanlarla tanışmak istiyorum.` → expected: chips *Bu akşam · Kadıköy · ≤ 700 TL · Küçük grup · Yeni insanlarla tanış · #tags*; no "meets your conditions" card; alternatives labelled e.g. *different date · different district · different interest*; Agora's line says it won't change conditions.
4. **Follow-up keeps conditions** — on the results page type `Yarın da olur ama bütçe aynı.` → only the date chip changes to *Yarın*; district, budget, group, tags stay; the conversation keeps both turns.
5. **Chips** — remove the district chip ("Any district") → Agora reruns with the user's click as a turn; pick "This weekend" from the date chip.
6. **Stale answer** — send two requests back to back (type one, then immediately click a direction): only the last request's answer must be shown (the first is dropped).
7. **Turkish** — language → Türkçe on desktop and from the mobile drawer (390 px): compass, results, event, calendar, guide and header in Turkish; no English leftovers except `/app/profile`, `/app/memories`, `/biz`.
8. **Reduced motion** — with "prefers-reduced-motion", the bezel and needle don't spin; everything still works.
9. **Keyboard** — results page on a phone: the "Tell Agora…" box stays above the keyboard and home indicator; Android back from an event returns to the results with the conversation intact (sessionStorage).
10. **Map** — "Show map" on the results page: markers for the listed events; the keyless embed appears if the Maps key is rejected.

## Known gaps (not done in this round)

- No microphone / voice input (no speech provider is wired — none is shown).
- No photo guide / image recognition (no provider wired; nothing fake is shown).
- Event photos: none exist in the data; organisers can supply one with tags `photo:<https-url>` + `photo_credit:<text>`; otherwise the typographic block is shown.
- "Follow a community" needs a new table (migration) — the community page shows the next gatherings only.
- AG-05 restaurant coverage, Qloo 429/timeout under load, security/load tests: not covered.
- `/app/profile`, `/app/memories`, `/biz/*` still English.
- Mobile apps: Capacitor shell builds in CI; nothing was run on a real device in this round.
