## Agora — v1 Plan

A minimal two-sided slice: lonely consumers find nearby events via an AI prompt; event-makers create events and see leads. Brand: "Agora" — modern minimal, circular gathering motif, subtle Greek-column accent.

### Brand & design
- Palette: warm parchment background, deep terracotta primary, olive accent, charcoal text (Mediterranean / agora feel).
- Type: Cormorant (display, headings) + Inter (body).
- Logo: SVG — circle of small dots around a center dot, one thin column stroke beneath. Used in nav + favicon.
- Marketing voice on landing: "Humans were never meant to be alone." Warm, not desperate.

### Pages / routes
```
/                       Landing (loneliness narrative, dual CTAs)
/login, /signup         Auth (email+password, Google)
/onboarding             Pick role: Member or Organizer
/app                    Member home: prompt bar + nearby events feed
/app/event/$id          Event detail + RSVP
/app/profile            Taste profile (music, sports, films, interests)
/app/integrations       Connect Spotify / IG / TikTok / YT / Letterboxd / Strava / Hevy (mocked toggles for v1)
/biz                    Organizer dashboard (KPIs, demand signals)
/biz/events             Event list + create/edit
/biz/leads              Lead list (RSVPs as leads, CSV export)
/biz/customers          Lightweight CRM (contacts, notes, last seen)
/biz/insights           "What members nearby are asking for" (aggregated prompts)
```

### Backend (Lovable Cloud)
Tables (RLS on all):
- `profiles` (id, role: member|organizer, display_name, city, lat, lng, bio)
- `taste_profiles` (user_id, music[], sports[], films[], interests[], free_text)
- `social_integrations` (user_id, provider, connected_at, mock_data jsonb) — v1 stores user-entered tags per provider, no real OAuth
- `organizations` (id, owner_id, name, category, city, lat, lng)
- `events` (id, org_id, title, description, category, starts_at, ends_at, lat, lng, capacity, price, tags[])
- `rsvps` (event_id, user_id, status, created_at)
- `prompts` (id, user_id, text, lat, lng, created_at) — feeds /biz/insights
- `customers` (id, org_id, user_id nullable, email, name, notes, tags[]) — CRM contacts
- `user_roles` + `has_role()` (separate table, per security rules)

Server functions (`createServerFn` + `requireSupabaseAuth`):
- `searchEvents({ prompt, lat, lng })` — calls Lovable AI Gateway (`google/gemini-3-flash-preview`) to extract intent/tags from prompt, then ranks events by tag overlap + distance + time.
- `rsvpEvent`, `createEvent`, `updateEvent`, `listMyEvents`, `listLeads`, `exportLeadsCsv`.
- `getDemandInsights(orgId)` — aggregates recent prompts near the org's location.

### Member flow
1. Sign up → onboarding picks Member → fills taste profile + city → optional mocked integration toggles.
2. `/app` shows prompt input ("Tonight I want…") + map-less list of nearby events for today/this week.
3. Submit prompt → AI ranks events → RSVP → event added to "Going".

### Organizer flow
1. Sign up → onboarding picks Organizer → create org (name, category, location).
2. Create event (form) → appears in member feed.
3. `/biz/leads` shows RSVPs; click to add to `customers` with notes.
4. `/biz/insights` shows top tags/keywords from nearby member prompts.

### Out of scope for v1 (explicit)
- Real OAuth for Spotify/IG/TikTok/YT/Letterboxd/Strava/Hevy (mocked as tag inputs; real OAuth is a follow-up per provider).
- Payments / paid event tickets (stub price field only).
- Email sending to customers (button stubbed; wire Resend later).
- Map view, chat/DMs, push notifications.

### Technical notes
- TanStack Start file-based routes; `_authenticated` layout for `/app/*` and `/biz/*`.
- Use `requireSupabaseAuth` on all server fns; admin client only for aggregated insights.
- Distance: simple haversine in SQL/JS — no PostGIS in v1.
- Single design system in `src/styles.css` (semantic tokens, oklch).

### Deliverable after build
Working landing + auth + member discovery (with AI prompt matching against seeded events) + organizer dashboard with event CRUD, leads, and demand insights.
