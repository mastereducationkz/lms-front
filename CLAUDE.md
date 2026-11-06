# CLAUDE.md — lms-front

The LMS web app: a React 18 + Vite 7 + TypeScript + Tailwind SPA (shadcn/ui and Radix), built into an nginx image. The API is the separate `lms-backend` repo. **The default branch is `master`**, and it is production. This repository is public: no secrets, hostnames of internal servers, or student data in anything you commit.

## Workflow

- **The GitHub issue is the task**: its done criteria («Готово, когда») set the scope; don't widen it without a reason, and ask when it is unclear. Task status lives in the GitHub Project, not in repo docs.
- **Understand first**: read the existing implementation before changing it, and start a large or non-obvious task with a read-only investigation and a plan. Facts come from the code, not from memory or this file; when they disagree, the code wins.
- **Behaviour changes come with tests**, and with fixes to whatever docs they make wrong (this file, the PR template). Commit, push or merge only when the user explicitly asks.
- **PR**: the body follows `.github/pull_request_template.md`, which also says when QA is required. A PR that needs QA gets the `staging` label: «Staging PR» deploys its branch to staging, and the «QA approved» status stays pending until a `/qa-ok` comment after the latest commit went live there. Nothing enforces it (the default branch has no protection): don't merge such a PR before the status is green. A change that needs a backend change is labelled in both repos. The staging stand is documented in lms-backend (`docs/infra/STAGING.md`, `deploy/staging/README.md`); the human process is the Confluence page «Как мы работаем: QA и релизы» (space SD).
- **Docs-only PRs** deploy nothing: Frontend CI is path-filtered (`.github/workflows/frontend-ci.yml`) and the deploy runs only after it succeeds on `master`.

## Production rules

- **`master` is production**: after Frontend CI passes on a push to `master`, «Deploy Frontend to Server» ships the newest verified commit. A commit that touches none of the CI paths (`src/`, `public/`, `index.html`, the package and Vite files, the Docker and nginx files, the deploy scripts, the two workflows) deploys nothing.
- **Production actions require explicit authorization**: no command against production (SSH, hand deploys, restarts) without it. Don't infer permission from task ownership or repository access; if authorization is unclear, stop and ask.
- **Student data (they are minors) never leaves the server**: no screenshots with names or phones, exports, or HAR files in a PR, issue, commit, doc or chat. No secrets either; name test accounts by login only.
- **Never point crawlers or automated tests at production.** Run the app against a local backend or staging (`VITE_BACKEND_URL` selects the API).

## Run and test

```bash
npm install
npm run dev        # vite on port 5174; API from VITE_BACKEND_URL (default http://localhost:8000)
npm test           # vitest run; Frontend CI runs it, and a failing test blocks the deploy
npm run build      # prebuild generates the PWA icons, then vite build → dist/
```

- There is no lint or typecheck script, and `vite build` does not type-check. Strictness is in `tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`); run `./node_modules/.bin/tsc --noEmit` and compare the error list with `master` rather than the count.
- Frontend CI (`frontend-ci.yml`): `npm ci`, `npm test`, `bash scripts/deploy_frontend.test.sh`, a production build, and a Docker image build.
- Before a PR: `npm test` and `npm run build`; for a UI change, open the page in a browser as the roles it affects, including a phone-width window.

## Architecture

- **Entry and routing**: `src/main.tsx` → `src/routes/Router.tsx` (react-router-dom v7, `BrowserRouter`). Pages are gated by `ProtectedRoute` inside the app layout; `AuthProvider` sits at the top.
- **API layer**: one axios client in `src/services/api/client.ts` and a module per domain next to it (`courses.ts`, `assignments.ts`, …). The client keeps the JWT in cookies (`CookieUtils`) and has its own request cache in `src/services/api/cache.ts`. Add the client function for a new backend endpoint here.
- **Path alias**: `@/` → `src/` (`vite.config.js`, `vitest.config.js`, `tsconfig.json`).
- **UI**: Tailwind and shadcn/ui (`components.json`), Radix primitives. Real-time chat goes through `src/services/socket.ts` (socket.io).
- **PWA**: `vite-plugin-pwa` with the service worker in `public/sw.js`; icons come from `scripts/generate-pwa-icons.mjs` at build time. A second page, `meet-addon.html`, is built as its own entry.
- **Staging**: a build with `--mode staging` (the Dockerfile's `VITE_MODE`, `.env.staging`) shows the red «STAGING · branch · commit» pill (`src/components/StagingBadge.tsx`). Check that the commit on it is the PR's latest before you test. A staging branch with a backend migration leaves the staging database ahead of `main`: run `staging reset` once the check is over (lms-backend `deploy/staging/README.md`).
