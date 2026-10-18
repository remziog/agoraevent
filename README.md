# Agora

Mobile-first web app for discovering small real-world gatherings — [ago-ra.life](https://ago-ra.life).

Stack: TanStack Start (SSR) · React 19 · Vite 7 · Tailwind v4 · Supabase (Auth, Postgres + RLS, Storage) · Lovable Cloud (AI gateway, Maps connector, email queue) · Cloudflare Workers.

## Local development

The project is managed by Lovable and uses **bun** (`bun.lock` is the lockfile of record; it is resolved against Lovable's registry mirror, so outside Lovable install without `--frozen-lockfile`).

```bash
bun install
cp .env.example .env.local   # fill in the values (see comments in the file)
bun run dev                  # http://localhost:5173
```

Useful checks:

```bash
bunx tsc --noEmit   # typecheck
bun run lint        # eslint (+ prettier)
bun run build       # production build (Cloudflare worker + client)
```

## Environment

`.env` is git-ignored. Publishable client values are prefixed `VITE_`; everything else is server-only and must never be exposed to the browser. The full list with comments lives in [`.env.example`](./.env.example).

## Database

Schema lives in `supabase/migrations/`. All tables have RLS enabled; server functions run with the caller's JWT (`requireSupabaseAuth`) and only use the service-role client for aggregated/public reads and gamification writes (`src/lib/*.server.ts`).
