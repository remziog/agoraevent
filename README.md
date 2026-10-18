# Agora

Mobile-first web app for discovering small real-world gatherings — [ago-ra.life](https://ago-ra.life).

Stack: TanStack Start (SSR) · React 19 · Vite 7 · Tailwind v4 · Supabase (Auth, Postgres + RLS, Storage) · Lovable Cloud (AI gateway, Maps connector, email queue) · Cloudflare Workers.

## Local development

The project is managed by Lovable, which syncs the `main` branch both ways. It uses **bun**; `bun.lock` is the lockfile of record, but it pins tarballs to Lovable's private registry mirror, so a plain `bun install` fails outside Lovable. Use the helper, which installs the exact same versions from npmjs:

```bash
bash scripts/install-outside-lovable.sh
cp .env.example .env.local   # server-only values; see comments in the file
bun run dev                  # http://localhost:5173
```

Useful checks:

```bash
bunx tsc --noEmit   # typecheck
bun run build       # production build (Cloudflare worker + client)
```

## Environment

- `.env` (tracked, managed by Lovable Cloud): publishable client values (`VITE_*`). Don't edit or delete it — Lovable's Vite config reads it at build time.
- `.env.local` (git-ignored): server-only secrets for local development. The full list is in [`.env.example`](./.env.example).

## Database

Schema lives in `supabase/migrations/`. All tables have RLS enabled; server functions run with the caller's JWT (`requireSupabaseAuth`) and only use the service-role client for aggregated/public reads and gamification writes (`src/lib/*.server.ts`).

**Migrations pushed through GitHub are not applied by Lovable.** To run one, ask Lovable in the chat to apply it, or paste the SQL into the Cloud SQL editor.

## Mobile apps

The iOS and Android apps live in [`mobile/`](./mobile/README.md): a Capacitor shell around a static build of this same code (`VITE_AGORA_NATIVE=1 vite build`). Native-only behaviour is gated on `IS_NATIVE_APP` in `src/lib/site.ts`; the website build is unaffected. CI (`.github/workflows/mobile-build.yml`) builds a debug APK and an iOS simulator build on every PR that touches the app.
