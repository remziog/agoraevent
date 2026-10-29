# Agora — handover for the independent test round (Codex), 29 Oct 2026

Written by the implementation session (Claude) for the 29 Oct scope: one compass path with real Qloo ranking for restaurants and places, a separate results stage with stage transitions, Save ≠ RSVP, My plans, My communities, voice input, streak semantics and the phone layout.

## What to test

| | |
|---|---|
| Repository / branch | `remziog/agoraevent`, PR of `hackathon/qloo-agent` → `main` (SHA in the PR) |
| Where | **Lovable preview of `main`** (not the published site): `https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app` — sign in there with the usual test account (its own session). **Nothing was published to ago-ra.life in this round** (joint review first). |
| Database | two new tables are live (`saved_items`, `community_follows`; migration `supabase/migrations/20261029130000_saved_items_and_follows.sql`, applied) — both RLS, own rows only. Existing tables unchanged. |
| Checks that pass locally | `npx tsc --noEmit` · `npx vite build` · `node --test tests/discovery.test.mjs` (12) · `node --test tests/streak.test.mjs` (4) · `node --test tests/qloo-schemas.test.mjs` (9) · `npx tsx --test tests/guide-agent.offline.test.ts` (7) · phone layout measured with Playwright at 320/360/390/430 px: no horizontal overflow, no input/direction overlap, text field + mic + send ≥ 44×44 |
| Not verified by Claude | the live Qloo path from the compass on the preview (needs a signed-in session on the preview origin), real-device keyboard, Google OAuth after the user's consent-screen change |

## Finding → status

| Finding | Root cause (verified in code) | Fix | Status |
|---|---|---|---|
| DISC-29-01 (P1) restaurant request answered with gatherings | `ask → discoverEvents` had one path (Agora events + tags), no Qloo | `discover` has an **intent** (restaurant / place / event) from explicit words (rules) or the model; restaurant & place intents go straight to Qloo `/v2/insights` with `filter.location.query="<district>, Istanbul"`, the kind's place tag (`/v2/tags`, place-scoped) and the favourites as `signal.interests.entities`. No landmark in between. A gathering request still goes to Agora listings. The intent is a chip the person can switch. | implemented; **verify live** (scenario 2) |
| Favourites → Qloo ids | free words were never Qloo entities | named favourites (model: proper nouns + field) are checked with the typed `/search`; an exact-name match is used, anything else becomes **one question** with the candidates (confirm / leave out); unknown names are said so. No favourite named → the taste profile (exact matches only) → else popularity, labelled | implemented; verify (scenarios 2–4) |
| Missing district | — | one question with district chips; the box still accepts a typed district | implemented |
| UI-29-01 rating decimals | raw `4.900000095367432` rendered | server rounds to one decimal, UI formats with the locale (`4,9` in Turkish); labelled as the business rating, not the taste match | fixed |
| UI-29-02 phone layout | centre input over E/W buttons; page 337 px wide at 320 | directions moved to the intercardinal points (desktop) and to a 2×2 row under the dial (phones); the text field sits under the dial on phones; rotated dial layers clipped; cards shrinkable; send/mic 44×44 | fixed (measured) |
| Save ≠ RSVP (P1) | no saved model | `saved_items` (event / place with snapshot), `saveItem` / `unsaveItem` / `getMyPlans`; Save never touches `rsvps`, attendee lists, calendar or XP; removing a save never cancels an RSVP | implemented |
| My plans / My communities | missing | `/app/plans` (going · saved gatherings · saved places), `/app/communities` (organisers of joined gatherings — worded as RSVP record, not membership — and followed communities, each with its next gathering); `community_follows` with follow/unfollow on the community page | implemented |
| STATE-29-01 (P2) streak after cancel | `awardXp` only subtracted XP on cancel | streak recomputed from the current RSVPs on every change (`streak.ts`); join → cancel nets to the previous value | fixed (unit-tested) |
| Voice input | none | browser SpeechRecognition (Chrome/Edge/Safari): mic in the dial's centre (phones) / in the field (desktop); listening → stop/cancel; transcript lands in the same field; the person edits and sends; unsupported browsers see a note and keep typing; no audio stored or sent | implemented; verify (scenario 7) |
| Transitions | none | compass → results carries the compass as one element (View Transitions API, `agora-compass`), results rise in with a stagger; reduced motion = instant cut; old answers stay dimmed while a new one is in flight and are never replaced by a slower, older one | implemented |

## Safe scenarios (no real reservations, payments or notifications)

1. **Compass stage** — `/app`: one headline, the dial, the field (desktop: inside the dial; phone: under it) with mic and send, the four directions (desktop: NE/SE/SW/NW; phone: 2×2 under the field). Nothing else above the fold.
2. **DISC-29-01** — type `Khruangbin ve Amélie seviyorum. Bu akşam Kadıköy'de iki kişilik sakin bir restoran öner.` → send. Expected: the needle spins; the results stage opens with the compass as a pill; chips **Restoran · Bu akşam · Kadıköy · Küçük grup**; "Qloo şuna göre sıralıyor: Khruangbin (sanatçı) · Amélie (film)" (if Qloo's search is ambiguous for one, a one-question card asks which); then **Qloo-ranked restaurants in Kadıköy** with ★ one decimal, price level, "Neden sana uygun: …" from Qloo's explainability. Open "Agora nasıl karar verdi": the taste line and the `/v2/insights` line with `N upstream · M parsed` counts. **Report those lines.** Below: "Agora'da ayrıca" gatherings (labelled Agora data) if any fit the district and window. No TOP MATCH gathering, no conversion of the request into an event search.
3. **Two taste profiles** — **"Yeni arama" first** (otherwise the favourites of the previous conversation stay in play), same district: `Bu akşam Kadıköy'de iki kişilik bir restoran. Metallica ve Fight Club severim.` → compare order and "why it fits you" lines with scenario 2. Both lists come from the same Qloo call shape; the signals differ. Report whether the order differs.
4. **One question** — `Kadıköy'de sakin bir restoran` with no favourite named: expected either your taste profile's favourites (chips marked "profil") or a popularity ranking that says so. `Bu akşam iki kişilik bir restoran` (no district) → the district question; tap Kadıköy → results, request line unchanged.
5. **Switch intent** — on the results stage click the intent chip → "Buluşma": the same conditions now run against Agora listings (exact / alternatives as before).
6. **Save ≠ RSVP** — save a restaurant (bookmark icon) and a demo gathering; `/app/plans` shows both under "Kaydettiğim…"; join the demo gathering → it appears under "Katılıyorum" too; remove the save → it stays under "Katılıyorum"; cancel the RSVP → it stays saved. Calendar and XP must not change on save/unsave. Refresh and re-login: saves persist.
7. **Voice** — Chrome: tap the mic (dial centre on a phone) → allow → say "Kadıköy'de bir kafe" → stop or pause → the text appears in the field, editable → send. Firefox: the mic shows the "not available in this browser" note; typing works.
8. **Streak** — note the streak on `/app/profile`, join a demo gathering, cancel it: the streak returns to the noted value.
9. **Communities** — join a demo gathering → `/app/communities` lists its organiser under "Bulunduğun yerler" with the next gathering; follow it from the community page → "Takip ettiklerim"; unfollow → gone.
10. **Transitions** — compass → results → back (pill): the compass morphs (Chrome/Edge/Safari; Firefox cuts); with "reduce motion" on, no animation anywhere. Send two requests back to back: only the last answer shows.
11. **Phones** — 320/360/390/430 px in Turkish: no horizontal scroll, the field never covers a direction, mic/send ≥ 44 px; the docked field stays above the keyboard on the results stage.
12. **Errors** — with the network throttled to offline on a Qloo request: the error card with "Tekrar dene"; nothing invented.

## PR #18 — fixes for the first independent round on PR #17 (Codex, 29 Oct afternoon)

| Finding | Root cause (verified) | Fix | Status |
|---|---|---|---|
| FLOW-17-01 (P1) district answer turned a restaurant request into a gathering search | `edits` was `ConstraintsSchema.partial()`; zod 4 applies a field's `.default()` even under `.partial()`, so `{ district }` arrived as `{ district, intent: "event", placeKind: null }` and overwrote the intent | `EditsSchema` (pure, `src/lib/discovery.schemas.ts`): only the named fields, no defaults; the server applies only defined fields | fixed, unit-tested (test 15); **re-test on the preview**: "Khruangbin ve Amélie seviyorum. Restoran öner." → district question → Kadıköy → restaurants, request line unchanged |
| DATE-17-01 (P1) "yarın akşam" → tonight | generic `aksam` pattern came before `yarin aksam`; first match won | specific tomorrow-evening patterns first; "yarın gece", "tomorrow night" included | fixed, unit-tested (test 13) |
| DATE-17-02 (P2) window start compared as text | `from < nowIso` compared "+03:00" and "Z" strings | instants compared (`Date.parse`) | fixed, unit-tested (test 14) |
| TR-17-01 (P2) alternative reasons in English | `discover.miss.*` / `discover.unverified.*` missing in `tr.json` | Turkish labels added (farklı tarih / farklı semt / bütçe üstü / farklı ilgi / grup büyüklüğü; fiyat doğrulanmadı / grup büyüklüğü belirtilmemiş) | fixed |
| A11Y-17-01 (P2) icon-only header actions without a name on phones; menu 36 px | text hidden under `sm`, no `aria-label`; `size="icon"` is 36 px | `aria-label` on Show/Hide map and New search; menu button 44×44 | fixed |
| Popularity note (P2) | footer text assumed favourites | footer says "popularity for this district" when no favourite was named | fixed |
| Phone voice draft replaced the typed text | mobile mic used `setPrompt(text)` | typed text kept, transcript appended (same as desktop) | fixed; re-test: type "İki kişi için", tap mic, say "yarın akşam Kadıköy'de restoran", stop → field holds both |
| Restaurant answers included coffee shops (P2 check) | Qloo's place tag "Restaurant" also covers cafés | for `restaurant` intent, café/coffee-shop place tags (from `/v2/tags`) go to `filter.exclude.tags`; if the host rejects the parameter the call is repeated without it | implemented; **verify on the preview**: the trace line shows `filter.exclude.tags`; Starbucks / Coffee Ya Basta should no longer appear under a dinner request |
| Streak 2 → 1 on first change (P2 check) | not a defect: the stored counter was built by increments; the first write recomputes it from the RSVPs that exist now (one real RSVP → 1) | documented; no data migration — the new number is the truthful one | no change |
| "Two profiles" compared in one conversation | by design the conversation keeps favourites; a second profile needs **Yeni arama** first | handover text updated | no change |

## Known gaps

- Google consent still shows Lovable until the owner switches **More → Users → Settings → Google → Your own credentials** (owner step; no code change needed).
- Qloo has no tag for every place word; those searches run untagged and say "places of any kind".
- `/app/profile`, `/app/memories`, `/biz/*` remain English. Native apps not run on a device in this round.
- The landmark guide (`/app/guide`) stays as the secondary path; "Explore gatherings" now hands its district and 7-day window to the compass as visible chips.
