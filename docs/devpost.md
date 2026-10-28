# Devpost submission — Agora: Your Istanbul, by taste

Draft for the Qloo Agentic Hackathon submission form (English). Fill the bracketed
parts before submitting; keep the "What's new since October 1" section — Agora is a
pre-existing project and the rules ask how it was updated during the submission period.

## Tagline (≤ 60 chars)

Tell Agora what you love. It finds your Istanbul.

## Elevator pitch (≤ 200 chars)

An agent takes a musician, a film and a book you love to Qloo's taste graph, ranks Istanbul's historic places against them, explains each pick with Qloo's evidence, then tells the place's story.

## About the project

### What it does

Agora is a travel companion that chooses places the way a well-read local friend would — from who you are, not from a top-ten list.

1. **You name three favourites** — a musician or band, a film or series, a book or author — and, if you like, a mood for the day. Nothing else about you leaves the app.
2. **You confirm what Qloo found** for each one ("Is this who you mean?" — the right _Blade Runner_, the right _Nick Cave_), so the agent ranks against the right thing. Uncertain matches are never assumed.
3. **An agent plans your visit.** It asks Qloo's taste graph to rank Agora's curated Istanbul landmarks against your confirmed favourites, picks three, chooses which part of each place's story to open with, finds restaurants in the first pick's neighbourhood that Qloo ranks for the same taste, and checks which Agora community gatherings are within walking distance this week.
4. **Every pick comes with evidence you can check.** Each card shows Qloo's rank and which of _your_ favourites Qloo's explainability credits for it; the agent's one-sentence note is labelled "Agora's note · AI" so you always know what is Qloo data and what is the model's voice. A "How Agora decided" panel lists every tool call and every Qloo request with its parameters, status and timing.
5. **Then the place tells its story.** Each landmark opens into labelled **History** and **Legend** sections — the records versus what the city tells — with narration you can listen to, opened at the section the agent chose for you.

### What makes it Qloo-powered

Without Qloo there is no ranking: Agora's own data is sixteen curated landmarks, authored stories and community events. Qloo supplies the connection between a person's cultural taste and a physical place:

- `/search` resolves free-text favourites to Qloo entities (confirmed by the person) and maps our landmarks to Qloo place entities at runtime.
- `/v2/insights` with `filter.results.entities` ranks our landmark shortlist against `signal.interests.entities` — the same call the official `qloo-harness` makes for `qloo_rank` — with `feature.explainability=true`, which is where the "credited favourites" on each card come from.
- `/v2/insights` with `filter.type=urn:entity:place`, `filter.tags` (restaurant) and `filter.location.query="<district>, Istanbul"` ranks restaurants around the chosen landmark for the same favourites.
- `/v2/tags` finds the restaurant tag at runtime.

Landmarks Qloo has no confident entity for are shown without a Qloo badge and are never ranked. Agora's own events are labelled as Agora data (and seeded demo events as "Sample"). If Qloo is unavailable the guide says so instead of showing something else as a Qloo result.

### How it is agentic

The guide is a Vercel AI SDK `ToolLoopAgent` running on Cloudflare Workers. The model holds five tools — `rank_landmarks`, `story_outline`, `restaurants_near`, `gatherings_near` and `submit_plan` — decides which to call, picks among Qloo's top results, chooses the story section to open with and writes the short notes; every fact on screen comes from tool executions recorded on the server, never from the model's text. Invalid picks are dropped and Qloo's order fills the gaps. The decision trace is part of the product, not a debug view: judges and users can see what the agent asked Qloo and what came back.

### What's new since October 1, 2026

Agora shipped in May 2026 as a mobile-first app for discovering small real-world gatherings in Istanbul (compass search over community events, organiser CRM, memories, gamification). For the hackathon we added, during the submission period:

- the Qloo integration (server-only client, runtime landmark mapping cached outside the repo, honest error states) and the favourites → confirm → plan flow at `/app/guide`;
- the tool-calling agent with its decision trace and explainability-credited picks;
- taste-ranked restaurants near a landmark and nearby community gatherings;
- authored History / Legend stories for the hero landmarks with spoken narration;
- a live diagnostics page (`/app/qloo-status`), an MIT licence and a public repository.

### Built with

TanStack Start (SSR) · React 19 · Vite · Tailwind v4 · Vercel AI SDK v6 (`ToolLoopAgent`, tool calling) · Gemini via the Lovable AI gateway · Qloo Insights API (`/search`, `/v2/insights`, `/v2/tags`) · Supabase (Auth, Postgres + RLS) · Cloudflare Workers · Capacitor (iOS/Android shells).

### Challenges

- **Workers vs. the harness.** The hackathon kit supports `qloo-harness` surfaces and says serverless is not a supported route; Agora runs on Cloudflare Workers, so it calls the same HTTP endpoints the harness wraps, with a bounded retry and a one-hour cache, and keeps the request → result trace visible.
- **No Qloo data in the repo.** Entity ids for our landmarks are resolved at runtime with a conservative rule (the name matches one of the landmark's aliases and Qloo places it in Istanbul) and cached in a server-only database table — never committed.
- **Honesty under failure.** Every path degrades to a labelled state: no key → "not configured", quota → "busy", no affinity → "Qloo could not rank any of Agora's landmarks for these favourites"; if the agent is unavailable Agora runs a fixed plan with the same tools and the trace says so.

### What's next

Free-text requests on the compass ("a quiet evening with people who like Tarkovsky"), short AI-made films for the hero stories, and the same taste ranking applied to Agora's community gatherings themselves.

## Testing instructions (for judges)

1. Open **[https://ago-ra.life](https://ago-ra.life)** and sign in with the test account: `[email]` / `[password]` (or create an account — email sign-up works).
2. Go to **Taste guide** in the top navigation (or `/app/guide`).
3. Enter a musician, a film and a book — e.g. _Nick Cave_, _Amélie_, _Agatha Christie_ — optionally a mood, and press **Find my Istanbul**.
4. On "Is this who you mean?" confirm the Qloo matches (or skip one) and press **Plan my visit**.
5. Read the three picks: Qloo's rank, the favourites Qloo credits, and the agent's note (labelled AI). Open **How Agora decided** to see the tool calls and the Qloo requests.
6. Tap **Hear the story** on a pick (Basilica Cistern, Hagia Sophia and Galata Tower have full stories) → **Listen**.
7. Scroll to **Eat nearby, matched to you** and **Gatherings this week**; the directions button opens the route.
8. `/app/qloo-status` shows the live Qloo state (credential, landmark map, raw explainability).

Works on phone browsers; narration uses the browser's speech synthesis.

## Links

- Live demo: https://ago-ra.life
- Repository: https://github.com/remziog/agoraevent (MIT) — hackathon notes in `docs/qloo-hackathon.md`
- Video: [optional]
