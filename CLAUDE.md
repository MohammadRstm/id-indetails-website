# CLAUDE.md

This file guides Claude Code when working in this repository. Read it, in every new session, before planning or
changing anything.

## What this is

The public website of **ID InDetails**, a company of architectural engineers (interior design and site execution).
Visitors see the company's projects on a 3D globe, on a moving strip and in a grid, with a page per project. There
are also a studio page, contact with a contact form, and privacy.

The site has **no content of its own**. Everything comes from the company's internal system:
- Admins manage the projects, services, locations, contact details, social links and settings in that system's
  **Website** area. Settings include "under construction" and the favicon.
- The site reads them from the API under `/api/public/website/`.

### The repositories

The checkouts sit under `C:\Users\masst\` on the laptop and `C:\Users\mohammadrstm\` on the desktop:

| Repo | Local checkout | What it is |
|---|---|---|
| Website (this one) | `Desktop\id-indetails-website` (`master`) | Vite + React 19 + TypeScript SPA, three.js globe |
| API | `source\repos\ID-Indetails` (`master`) | ASP.NET Core .NET 10. `docs/website.md` there is the contract this site depends on. |
| Client | `Desktop\Ident-Internal-Management-System-client` (`main`) | The internal app, where admins edit what this site shows. |
| Mobile app | `Desktop\ID-Indetails-mobile` (`main`) | The phone app (Expo + React Native), another client of the API. |

The GitHub remote still has its old name (`id-indetails-earth-portfolio`) and redirects to `id-indetails-website`.

## What to read before working on a feature

1. **`README.md`** is the architecture doc. It covers rendering, structure, behaviour, analytics, the website API, hosting, CI, assets, testing, photo protection and known limitations.
2. **The API's `docs/website.md`**, for any data or endpoint change. A new field or endpoint is an API change first: one `MR-<Topic>` PR in the API, then this site.
3. **The code of the area**, listed in the next section.

## Structure

- **`src/main.tsx` → `App.tsx`.** Routing is hand-rolled with the History API in `src/hooks/useSiteRoute.ts`:
  - the routes are `/`, `/projects/<slug>`, `/studio`, `/contact` and `/privacy`;
  - filters and paging live in the query string;
  - unknown paths fall back to home.
- **`src/components/`** holds the pages and UI. `Explorer.tsx` is the globe, strip and grid view. It stays mounted behind the other pages.
- **`src/globe/`** is the three.js and `@react-three/fiber` globe:
  - custom GLSL shaders, rendered on demand;
  - `GlobeStage` is a lazy chunk preloaded by `preload.ts`;
  - `GlobeController.ts` is pure logic;
  - `quality.ts` sets the quality tiers.
- **`src/api/`:**
  - `website.ts` is the only API client;
  - `parsers.ts` validates every reply, dropping and logging a bad row;
  - `errors.ts`, plus `config.ts` (`VITE_API_BASE_URL`, default same-origin `/api/public/website`).
- **`src/hooks/`, `src/lib/`, `src/data/`, `src/analytics/`:**
  - `lib/` holds pure helpers, each with a sibling `*.test.ts`;
  - `data/` holds the types;
  - GA4 runs behind a consent banner, and only when `VITE_GA_MEASUREMENT_ID` is set.
- **`src/styles/global.css`** is plain CSS with variables in `:root`, plus `src/globe/globe.css`. There is no Tailwind and no CSS modules.

## Commands

- **`npm run dev`:** Vite on port 5173.
  - The dev and preview proxy for `/api/public/website` goes to the **live site** unless `DEV_API_TARGET` is set.
  - So a local contact-form submit reaches the real inbox. Point `DEV_API_TARGET` at your local API when testing forms.
- **`npm run typecheck`, `npm run lint`, `npm test`:** `tsc -b`, ESLint and Vitest. Tests cover pure logic only; there are no component or e2e tests.
- **`npm run build`:** `tsc -b && vite build`. The globe chunk is about 750 kB, so Vite's size warning is expected.

- **Ask before running builds or tests.** The user works from two machines:
  - a laptop that shuts down under load;
  - a desktop that comfortably runs on several cores.

  Before the first build or test run in a session, ask whether to run on **one core at low priority** (the laptop) or normally (the desktop). Keep to the answer for the rest of the session.
- **On the laptop:** run checks one at a time, at low priority, only for what you touched.

## How it ships

- **CI** (`.github/workflows/ci.yml`, on PRs and pushes to `master`) does three things:
  - the Dockerfile's `check` stage;
  - a runtime image build with a smoke test (pages answer 200, `/api/*` other than the website API returns 404, headers, caching, non-root);
  - a Trivy scan.
- **Publish** (`.github/workflows/publish.yml`) is started by hand, with production approval:
  - it pushes `ghcr.io/mohammadrstm/id-indetails-website:sha-<7>`;
  - it writes `WEBSITE_TAG` into the server's `.env`;
  - it restarts only the `website` service.

  The API's Deploy workflow never touches the website. Never start Publish unless asked.
- **`deploy/nginx.conf`:**
  - it serves the SPA and proxies only `/api/public/website/` to the API; every other `/api/` path is 404;
  - it sets a strict CSP and security headers.
  - **A new external origin** (font, script, image, iframe) must be added to the CSP, or it is blocked.
  - The headers are repeated in each `location` that adds its own `add_header`. Keep that when editing.

## Keeping this file current

This file is how every new session learns the project, so keep it true:
- **When your work changes something written here, propose an edit to this file.** That includes a rule, a workflow, a file or folder, a command, or a business rule.
- **When the user tells you a new rule or preference, also propose an edit** so later sessions follow it.
- **Ask the user's permission first, every time.** Show the exact change and wait for a yes. This applies above all to the rules sections. Never change this file on your own.

## Conventions and gotchas

- **Code style:**
  - Function components with named exports (except `App`), PascalCase files and `useX` hooks.
  - Keep logic out of React and three where possible, and test it as pure functions.
- **Accessibility and motion:**
  - Keep the skip link, the live region that announces the current project, and keyboard Previous/Next.
  - Respect `prefers-reduced-motion` and the motion toggle.
  - The strip and globe markers are deliberately pointer-only.
- **Images:** they all come from the API, in root-relative paths resolved by `resolveAssetUrl`. None are committed. `lib/protectPhotos.ts` deters saving photos.
- **API failures:** there is no fallback data. A failed projects call shows a reload message, and each failed content part is logged and its section left out.
- **Slugs:** a project's slug comes from its title in the API, so renaming a project changes its URL.
- **Ignore `.claude/worktrees/`:** it holds another session's full worktree, untracked. Leave it out of searches and commits.
- **`PrivacyPage.tsx`** still has placeholder company details in brackets, to fill in before launch.
- **Git:** never commit to `master`. Work on `MR-<Topic>` branches, with one PR each.
