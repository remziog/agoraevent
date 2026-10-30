# Devpost submission — Agora

Paste-ready blocks for the Qloo Agentic Hackathon form, in form order. The text is
finalised against the version live at https://ago-ra.life at submission time, and
the screenshots come from the same version. Agora is a pre-existing project, so the
"What's new since October 1, 2026" block is required.

## Project overview

**Name:** Agora

**Elevator pitch (≤ 200 characters):**

Tell Agora's compass what you love, by text or voice. An agent uses Qloo's taste graph to pick Istanbul restaurants and places that fit your taste, and links you to real local gatherings.

## About the project

### The problem

Istanbul has thousands of restaurants and venues, and the usual ways to choose one — star ratings, top-ten lists, popularity — say nothing about *you*. Two people with very different taste get the same list. And when the evening ends, nothing connects you to the people who share that taste.

Agora is for visitors, newcomers and locals who want an evening that fits their taste and a way to meet the same kind of people again: name what you love, get places ranked for it, and find the real gatherings nearby.

### What it does

One compass, one conversation:

1. **Say or type what you want**, in English or Turkish — *"I love Khruangbin and Amélie. Recommend a restaurant."* — or tap one of ten categories on the compass (food, coffee, music, exhibitions…) and choose a district or "use my location" (turned into the nearest district on the device; coordinates never leave it). Voice input fills the same box, so you can correct it before sending.
2. **Agora reads the request:** what you want (a restaurant, a place or a gathering), your favourites, and your conditions — district, time window in Istanbul time, budget, group size, meeting people. Every condition is a visible chip you can change; a missing district is asked once, never guessed.
3. **Your favourites are checked with Qloo.** An exact match is used; when Qloo knows more than one (*which Amélie?*) Agora asks; a name Qloo doesn't know is reported and left out.
4. **Qloo ranks real places in that district for your taste.** Each card shows Qloo's rank, which of your favourites Qloo's explainability credits for it ("Why it fits you"), the business's rating — labelled as a rating, not a taste match — and Qloo's tags. With no favourite named, Agora uses your saved taste profile, or says plainly that the list is Qloo's popularity ranking.
5. **Then people.** Next to the places, Agora shows its own gatherings in the same district and time window — labelled as Agora data, not Qloo — each linking to its community and the organiser's next meet-ups.
6. **Keep what you like.** Save a place or a gathering (saving is not an RSVP), RSVP to free gatherings with the date and price in view, add a gathering to your own calendar (.ics or Google Calendar), see both in **My plans** and the calendar, and follow organisers in **My communities**.
7. **Keep talking.** A follow-up changes only what you say — *"Tomorrow evening in Beşiktaş"* moves the time and the district and keeps your favourites. A slow old answer never overwrites a newer one.
8. **Count what you actually did.** "I went here" on a place (or "I attended" on a gathering, once it has started) records a self-reported experience on your device. It fills **Bingo** — a monthly 3×3 card of city experiences (a new café, a new cuisine, a new neighbourhood, an exhibition…) — and five badges in your profile, your personal city archive.

The **Taste guide** (`/app/guide`) is the deeper mode: name a musician, a film and a book, and an agent ranks Agora's curated Istanbul landmarks against them, opens each place's story (History and Legend kept apart, with narration) and suggests taste-matched restaurants nearby.

### What makes it Qloo-powered

Agora's own data is community gatherings and authored landmark stories; it has no notion of taste. Qloo supplies the link between what a person loves and a real place:

- **`/search`** with a typed `types` filter verifies each favourite as the right kind of entity (an artist, a film, a book).
- **`/v2/tags`** finds the place-scoped restaurant tag and the café tags at runtime.
- **`/v2/insights`** with `filter.type=urn:entity:place`, `filter.location.query` (the district, Istanbul), `filter.tags` (restaurant), `filter.exclude.tags` (cafés, for a restaurant request), `signal.interests.entities` (the verified favourites) and `feature.explainability=true` ranks the places and says which favourite drives each pick.
- **`/v2/insights`** with `filter.results.entities` ranks Agora's landmark shortlist in the Taste guide — the same call the official `qloo-harness` makes for `qloo_rank`.

Without Qloo there is no ranking, and two different tastes in the same district get different lists. Qloo receives only taste terms, tags and a district name — never a name, an email or a location. Qloo results carry a Qloo badge; everything else is labelled as Agora data or as popularity.

### How it is agentic

- **The compass** is a multi-turn assistant. A model reads the intent, favourites and interests in free text (explicit words in the request take precedence); the server then runs the steps — verify with Qloo, ask one question when needed, rank with Qloo, add Agora's gatherings — and carries the conversation's state across turns. Every step is listed under **How Agora decided**, with each Qloo request, its status, its timing and how many results were readable.
- **The Taste guide** is a Vercel AI SDK `ToolLoopAgent` on Cloudflare Workers with five tools (`rank_landmarks`, `story_outline`, `restaurants_near`, `gatherings_near`, `submit_plan`). The model chooses the calls and writes short notes labelled "AI"; every fact on screen comes from recorded tool results, never from the model's text.

### Design

Agora's identity and interface are by **Naz Paşalı, our Creative Director**. She drew the new geometric AGORA wordmark and a two-sided system: a warm paper-and-ink day side (condensed Archivo headlines, Instrument Sans, DM Mono labels) and a night field for discovery — a living colour field, her own WebGL shader, that gathers light around the compass and quickens while Agora searches (and holds still for anyone who prefers reduced motion). The compass is hers too: ten categories you select, then discover; a location chooser; a needle that turns toward the category and, once the answer arrives, points at the real places around the district on a small map of Istanbul's coastline — true bearings, distances in kilometres. Places and gatherings without a photo get generative posters seeded by their names instead of stock or AI images. She also designed the event page (poster, Add to calendar), the calendar and plans, the bottom navigation, the profile as a personal city archive, and **Bingo** — a monthly 3×3 card of city experiences you fill by marking what you actually did.

### How we built it

TanStack Start (SSR) on Cloudflare Workers · React 19 · Tailwind v4 · WebGL (the living colour field) · Supabase (Auth, Postgres with row-level security) · Vercel AI SDK v6 with Gemini through the Lovable AI gateway · the Qloo Insights API through a server-only client (the key never reaches the browser) · the Web Speech API for voice · Capacitor shells for iOS and Android.

### Challenges

- **A silent zero.** Qloo answered, but one item with an unexpected field made a strict schema drop the whole list, so it looked like "no results". Each item is now read on its own, and every call shows how many results came back, how many were readable and how many were used.
- **Same name, wrong place.** A mosque with the same name 55 km away is not the landmark: a place is matched only when the name agrees and Qloo's coordinates sit at the place.
- **A restaurant request is not an event search.** The intent decides who answers — Qloo for places, Agora for gatherings — and a follow-up may change only the fields it names.
- **Workers vs. the harness.** The hackathon kit's supported route is `qloo-harness`; Agora runs on Cloudflare Workers, so it calls the same HTTP endpoints the harness wraps, with a bounded retry and a one-hour cache.

### Known limits

- Budget, date and group size filter Agora's gatherings; for Qloo's places they are shown but not yet used to filter.
- Qloo's district filter is a text match, so a few results can sit just outside the district.
- With no favourite named, Qloo's popularity list for a district can include hotels among the restaurants.
- Voice input depends on the browser's speech recognition (Chrome, Edge, Safari); typing always works.
- The gatherings are seeded demo listings, labelled "Demo"; a demo gathering cannot be marked as attended.
- Bingo records are self-reported and stored on the device only (another device starts empty); nothing is verified, and the reward tiers are shown as "not available" because there is no partner agreement yet. Each month starts a new card (Istanbul time).

### What's new since October 1, 2026

Agora launched in May 2026 as a mobile-first app for small real-world gatherings in Istanbul (event discovery, organiser tools, calendar, memories). During the submission period we added:

- the Qloo integration: a server-only client, runtime landmark mapping kept out of the repository, honest error states and a live status page;
- the one-compass flow: intent, explicit conditions, favourites verified with Qloo, one clarifying question, Qloo-ranked restaurants and places with explainability;
- the Taste guide agent with its decision trace, landmark stories and narration;
- voice input, Save vs. RSVP, My plans, My communities and following;
- Naz Paşalı's redesign: the new identity, the night compass with categories, a location chooser and a map of the answer, generative posters, the event page with Add to calendar, the calendar and plans, and bottom navigation on phones;
- Bingo and the city archive: "I went here" / "I attended" records (self-reported, kept on the device) fill a monthly 3×3 card and five badges;
- Turkish localisation; mobile layouts from 320 px; an MIT licence and a public repository.

### What's next

Map budgets to Qloo's price levels, tighten district filtering with coordinates, rank Agora's own gatherings by taste too, sync Bingo to the account and verify squares with partner venues (a code at the venue) before any reward exists, native sign-in and push notifications in the iOS and Android apps, and more cities.

## Built with

qloo · typescript · react · tanstack-start · vite · tailwindcss · webgl · cloudflare-workers · supabase · postgresql · vercel-ai-sdk · gemini · web-speech-api · capacitor · lovable · zod

## "Try it out" links

- https://ago-ra.life
- https://github.com/remziog/agoraevent

## Additional info (judges only)

- **When did you start this project?** May 2026 (Agora); the Qloo work started on October 18, 2026.
- **Public URL:** https://ago-ra.life
- **Public repository:** https://github.com/remziog/agoraevent
- **How was it significantly updated for Qloo?** Paste "What's new since October 1, 2026".

## Testing instructions (for judges)

1. Open https://ago-ra.life and sign in: create an account with email or Google, or use the test account in the judges' notes.
2. On the compass, type or say *"I love Khruangbin and Amélie. Recommend a restaurant."* and pick a district (for example Kadıköy).
3. Read the cards — Qloo's rank, "Why it fits you", the rating note — and open **How Agora decided** to see each Qloo request.
4. Follow up with *"Tomorrow evening in Beşiktaş."* — only the time and the district change.
5. Ask again with a different taste in the same district to see the ranking change.
6. Save a place or a gathering → **My plans**; open a gathering → its community → **Follow** → **My communities**; RSVP (free, confirmed) → **Calendar**.
7. **Taste guide** (`/app/guide` — the link at the bottom of the compass screen, "Prefer a landmark tour by taste?"): a musician, a film and a book → confirm the matches → three landmarks with Qloo's evidence, their stories and narration.
8. **Bingo:** open a place from step 3 → **I went here** → the toast names the squares it filled, the **BINGO n/9** ticket on the compass screen counts them, and the card (`/app/bingo`) and **Profile** show the record — marked self-reported, with undo.

Works in phone browsers; voice input needs a browser with speech recognition.
