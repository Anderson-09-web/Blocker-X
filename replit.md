# Blocker X

A professional Discord bot hosting platform where developers upload, edit, deploy, and manage Python and JavaScript bots through a dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/blockerx run dev` — run the frontend (port 25673, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, uses NEON_DATABASE_URL)
- Required env: `NEON_DATABASE_URL` — Neon PostgreSQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + wouter routing + framer-motion
- API: Express 5 + express-session + connect-pg-simple
- DB: PostgreSQL (Neon) + Drizzle ORM
- Storage: Cloudflare R2 via @aws-sdk/client-s3
- AI: Groq (llama3-70b-8192) via /api/ai/chat
- Auth: Discord OAuth2 (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/db/src/schema/` — all Drizzle ORM table definitions
- `lib/db/src/index.ts` — DB connection (uses NEON_DATABASE_URL with SSL)
- `lib/api-client-react/src/generated/` — Orval-generated hooks (do not edit)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/lib/` — r2.ts, session.ts, auth-middleware.ts, notifications.ts
- `artifacts/blockerx/src/pages/` — all frontend page components
- `artifacts/blockerx/src/lib/auth-context.tsx` — auth state + redirect logic
- `artifacts/blockerx/src/components/layout/` — sidebar + dashboard layout

## Architecture decisions

- **DB uses NEON_DATABASE_URL** (not DATABASE_URL) — always use this env var; drizzle.config.ts and lib/db/src/index.ts both check NEON_DATABASE_URL first.
- **R2 storage is file-only** — file paths are never stored in DB. Each bot gets `users/{discordId}/bots/{botId}` as an R2 prefix.
- **Owner Discord ID 1237892993013387307** skips invite requirement and gets isAdmin=true automatically on first login.
- **Sessions stored in PostgreSQL** via connect-pg-simple (creates `sessions` table automatically).
- **Dark theme only** — `.dark` class applied to `<html>` on mount in main.tsx; no theme toggle.
- **API codegen collision fix** — lib/api-zod/src/index.ts uses explicit named exports to exclude colliding Params types (GetBotLogsParams, ListFilesParams, etc.).

## Product

- Discord OAuth2 login with invitation code gate
- Bot management: create, start, stop, restart, deploy Python/JS bots
- File manager backed by Cloudflare R2 (per-bot prefix in R2)
- Environment variable manager per bot
- Real-time bot logs with auto-refresh
- AI assistant (Groq llama3-70b) for bot development help (10 req free, unlimited premium)
- Deployment history and status tracking
- Notification system (per-user + admin broadcast)
- Admin panel: user management, invite codes, platform stats, audit logs

## User preferences

- Owner Discord ID: 1237892993013387307 (gets admin + invite bypass automatically)
- Dark theme only — no toggle
- No emojis in the UI

## Gotchas

- **DB push**: Run `NEON_DATABASE_URL=$NEON_DATABASE_URL pnpm --filter @workspace/db run push` — the env var must be set explicitly.
- **Tailwind v4**: Cannot use `@apply dark` in CSS — apply the `.dark` class via JS (main.tsx does `document.documentElement.classList.add("dark")`).
- **Discord OAuth redirect URI**: Dynamically built from REPLIT_DOMAINS or REPLIT_DEV_DOMAIN env vars in auth.ts.
- **API base path**: The API server handles its full path prefix (`/api/...`) — no path rewriting by the proxy.
- **Orval output**: Do not modify generated files in `lib/api-client-react/src/generated/`. Run codegen after OpenAPI changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
