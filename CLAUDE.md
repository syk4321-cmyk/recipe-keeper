# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"내 레시피 서랍" (recipe-keeper) — a React PWA for organizing recipes parsed from photos or text, with folders, shopping lists, and a cooking mode. Deployed as a static site + serverless functions on Netlify, and packaged as an Android app via Capacitor. Originally scaffolded on Replit (see `.replit`), now hosted on GitHub with Netlify as the deployment target.

## Commands

Root (pnpm workspace):

```bash
pnpm install                # install all workspace packages
pnpm run typecheck          # typecheck lib/* packages, then artifacts/* and scripts
pnpm run build              # typecheck + build all packages (-r --if-present run build)
```

Frontend app (the actual product):

```bash
pnpm --filter @workspace/blank-react-app run dev        # Vite dev server, host 0.0.0.0
pnpm --filter @workspace/blank-react-app run build       # production build -> dist/public
pnpm --filter @workspace/blank-react-app run typecheck   # tsc --noEmit
```

Local Replit-preview API server (Express, not used in the Netlify deployment):

```bash
pnpm --filter @workspace/api-server run dev
```

There is no test suite in this repo (no jest/vitest config, no test scripts).

`pnpm` is required — the root `preinstall` script deletes `package-lock.json`/`yarn.lock` and fails if invoked via npm/yarn.

## Architecture

**Two parallel backends exist — only one is actually deployed.** The production app talks directly to Firebase from the client and to Netlify Functions for AI calls. `artifacts/api-server` (Express) + `lib/db` (Drizzle/Postgres) + `lib/api-spec` (OpenAPI/Orval codegen) + `lib/api-client-react` / `lib/api-zod` are a Replit-workspace scaffold used only for local Replit preview (`pnpm --filter @workspace/api-server run dev`); nothing in `artifacts/blank-react-app` imports from `@workspace/api-client-react` or `@workspace/api-zod`, and Netlify never builds or runs the Express server. Don't assume changes to the Express/Postgres side affect the deployed app, and don't assume the deployed app has a SQL database at all.

**Data layer is Firebase, not the workspace `db` package.** `artifacts/blank-react-app/src/firebase.js` initializes Firebase Auth + Firestore directly in the client (`cookmark-3c4f3` project). Login (`LoginScreen.jsx`) and all recipe/folder/shopping-list persistence go through Firestore from the browser — there is no REST API for app data.

**AI recipe analysis is duplicated across two entry points that must be kept in sync.** `netlify/functions/recipe-analyze.ts` (used in production) and `artifacts/api-server/src/routes/recipe.ts` (used in local Replit preview) independently implement the same call to the Anthropic Messages API (model `claude-sonnet-4-6`) with the same content-block validation. There's also `netlify/functions/video-caption.ts` for a second AI-backed feature. `ANTHROPIC_API_KEY` must be set in the Netlify site's environment variables (or locally) — it's never committed, and Replit Secrets do not carry over to Netlify.

**The app UI is one large component, intentionally kept as JSX.** `artifacts/blank-react-app/src/RecipeKeeper.jsx` (~3600 lines) is the whole app and is imported by `App.tsx`. A comment in `App.tsx` explains this is deliberate, to keep the component easy to paste/edit as a standalone unit. `RecipeKeeper-23.jsx` (~3245 lines) sits alongside it but is not imported anywhere — treat it as a superseded snapshot, not live code, unless told otherwise.

**Netlify routing** (`netlify.toml`): builds only `@workspace/blank-react-app`, publishes `artifacts/blank-react-app/dist/public`, serves functions from `netlify/functions`, redirects `/api/recipe/analyze` and `/api/recipe/video-caption` to their respective functions, and falls back all other paths to `index.html` for client-side routing (wouter).

**Android build** lives under `artifacts/blank-react-app/android`, wired through Capacitor (`capacitor.config.ts`). It wraps the same Vite build rather than being a separate codebase.

**pnpm workspace layout**: `artifacts/*` are deployable apps (blank-react-app, api-server, mockup-sandbox), `lib/*` are shared/scaffold packages (db, api-spec, api-zod, api-client-react), `scripts` holds workspace utility scripts. Many dependency versions are pinned centrally via the `catalog:` mechanism in `pnpm-workspace.yaml` rather than per-package.

## Gotchas

- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (packages must be published 1+ day before install is allowed) as a supply-chain defense — do not lower or remove this, and only add to `minimumReleaseAgeExclude` for well-established, trusted scopes.
- Never put the real `ANTHROPIC_API_KEY` (or any secret) into `.env`, source, or the Netlify redirects config — `.env.example` documents the required variable but must stay empty.
