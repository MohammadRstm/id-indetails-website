# ID-Indetails project globe

A 3D Earth landing page for ID-Indetails, an architecture studio. A dark globe with country borders sits beside a slowly drifting strip of project photographs; as each project passes the centre of the strip, the globe turns to its place and that country's border glows cyan. Opening a project fades the strip out and its photograph back in on the right half of the page while the planet slides into the left half, leaning so its edge runs diagonally, and zooms in on the place; both are half the screen's height, with the project's description and facts right below them. Two red points mark the studio's offices. A Studio page lists what the studio does, and a Contact page has an enquiry form, phone numbers and each office on a Google map. Built with React, TypeScript, Vite and React Three Fiber, using custom GLSL shaders for the Earth, markers, routes and stars.

Everything it shows (projects, studios, services, contact details, social links and the favicon) comes from the ID-Indetails website API and is edited in the app's Website area; the site holds no content of its own.

## Getting started

Requires Node.js 22.12 or newer (Vitest 5 sets the floor; developed on Node 24).

```bash
npm install
npm run dev        # dev server, http://localhost:5173 by default
```

Press `Ctrl+C` in the terminal to stop the dev server.

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Starts the Vite dev server with hot reload.               |
| `npm run build`     | Type-checks (`tsc -b`) then builds to `dist/`.            |
| `npm run preview`   | Serves the production build from `dist/` locally.         |
| `npm run lint`      | Runs ESLint (including the React Hooks / Compiler rules). |
| `npm run typecheck` | Runs `tsc -b` over the app, config and test projects.     |
| `npm test`          | Runs the Vitest unit tests once.                          |

## Rendering approach

`react-globe.gl` was evaluated first and not used:

- Its rotation is a camera orbit driven by `OrbitControls`, which takes over touch input, so phones cannot scroll past the globe.
- A day/night terminator with a camera-relative sun would need a second per-frame loop next to its internal tween and render loop.
- It pulls in `globe.gl`, `three-globe`, `kapsule`, `tween.js` and `three-render-objects`.

Instead the site uses React Three Fiber with custom `ShaderMaterial`s and `frameloop="demand"`. A single `useFrame` driver advances the globe and asks for another frame only while something is moving or the marker ripples are playing; with motion paused or the globe scrolled out of view, the page renders nothing. The blue markers and route arcs are drawn in the scene; invisible DOM buttons on top of them are projected from the rotating globe once per rendered frame and carry the click targets.

## Architecture

```text
src/
  analytics/   Google Analytics: the cookie question, page views and events
  api/         Client for the public website API: endpoints, reply checks, errors
  data/        Typed project model and the data source
  globe/       Everything inside and around the 3D canvas
  components/  Page UI
  hooks/       Small React hooks
  lib/         Pure helpers (geo maths, country outlines, seeded random, WebGL check)
  styles/      Global CSS
  test/        Made-up projects and offices for the tests
```

**`src/data`**

- `project.ts` defines the typed `Project` model: a numeric `id` and a URL-safe `slug` (the page address is `/projects/<slug>`; the API makes the slug from the project's name, so renaming a project changes its address), images with alt text, description, status (completed or in progress), client organisation (may be empty), location (city, country, the ISO two-letter `countryCode`, and the marker's `lat`/`lng`; the city may be `null` when only the country is known; `approximate` is true when the API picked the marker's point rather than it being typed in, and then the site shows no coordinates, see `placeName` and `hasExactPosition`), year, a type (`type`, its key like a slug, `villa` or `beach-house`: the dashboard takes any architectural type; and `typeLabel`, as shown: Villa, Beach house; the type filter offers the types the projects have), and whether it shows in the landing page's strip (`showInConveyor`, `conveyorOrder`; at most `CONVEYOR_LIMIT`, 20). The fields match the public website API.
- `site.ts` and `offices.ts` hold the types of the company details and the studios, in the shapes the API sends.
- `contactSource.ts` exposes `sendContactMessage()`, which posts the message to the API (`postContactMessage`). `contactFailure()` in `lib/contactForm.ts` turns a failed send into what the form tells the visitor.

**`src/analytics`** is Google Analytics 4 (see "Analytics" below): `analytics.ts` loads Google's tag once a visitor accepts, and sends the page views and events; `consent.ts` keeps the visitor's answer; `pageLocation.ts` cleans the page address before it is sent.

**`src/api`** is the client for the public website API (`/api/public/website`, built in the ID-Indetails backend): one function per endpoint in `website.ts`, checks of every reply against the shapes the site relies on in `parsers.ts` (a broken row in a list is dropped and logged rather than taking the page down), errors from the API's `ApiErrorResponse` shape in `errors.ts`, and the base URL and image-address handling in `config.ts`. See "The website API" below.

**`src/components`**

- `Explorer.tsx` is the page: the globe, the caption and controls, the strip, the grid of every project below them, and the project page. It decides which view shows and keeps the globe, strip and address bar in step.
- `ProjectStrip.tsx` is the endless strip. Its position is a number of cards (`offset`); the card nearest the centre is the current project. A `requestAnimationFrame` loop drifts it, settles it with a critically damped spring and writes transforms straight to the DOM; React re-renders only when a new card needs mounting. Vertical on wide screens, horizontal below 960 px. Its cards are 3:2 landscape (`CARD_ASPECT`); on wide screens the strip's column is about a fifth of the window, and the globe's frame reaches into the margin and the gap beside it by about the room the globe leaves inside it, so the globe's edge lines up with the logo and sits as far from the strip as the strip from the caption.
- `ProjectCaption.tsx` is the name, place and summary beside the strip. `ProjectDock.tsx` is the photograph held in the right half of a project page, beside the globe; it fades in with the Web Animations API once the strip has faded out, animating only opacity and `transform` so the GPU compositor keeps it smooth while the page sets up the project view. `ProjectPage.tsx` holds `ProjectHeading` (the title at the top left of the globe's half) and `ProjectPage` (the page below it). `ProjectGallery.tsx` is the project's photos, laid out in columns like a masonry wall (each photo whole, at its own shape, set under the shortest column so far; the column count follows the width, and `layoutMasonry` in `lib/gallery.ts` does the arithmetic), and the viewer they open (a modal `<dialog>`).
- `ProjectConcept.tsx` is a project's optional concept row, under its description: up to five concept pictures on the left (not the gallery's) and their text on the right, so the page zigzags. The first picture is the main one and keeps the left half once there are others: two share the width, three and four stack the rest in one column beside it, five put a 2×2 block there (`.concept__grid[data-count]`). Each opens the same viewer as the gallery (`PhotoViewer`, exported from `ProjectGallery.tsx`). The row is left out when the project has neither, and on phones the pictures come first with the text below.
- `HomeProjects.tsx` is the grid of every project under the globe: `ProjectFilterBar.tsx` (the search, filters and sort, with the logic in `lib/projectFilters.ts`), the cards (`ProjectCard.tsx`) and the pages (`lib/pagination.ts`).
- `StudioPage.tsx` and `ContactPage.tsx` are the other two pages; `ContactForm.tsx` is the enquiry form (its checks are in `lib/contactForm.ts`). The maps are Google's keyless embed of each office's coordinates, darkened with a CSS filter to suit the site.
- `PrivacyPage.tsx` is the privacy notice and `ConsentBanner.tsx` the cookie question (see "Analytics").
- `SiteHeader.tsx`, `SiteFooter.tsx` (social links, the privacy notice and Cookie settings), `PageLink.tsx`, `MotionToggle.tsx`, `ScrollLink.tsx` and `icons.tsx` are the rest of the page.

**`src/globe`**

- `GlobeStage.tsx` is the DOM side: pointer drag, measuring the layout frame the globe is centred in, the marker click targets, the loading indicator and the notices. It pauses the ripples while the globe is off screen.
- `GlobeScene.tsx` holds the scene graph and `GlobeDriver`, the single on-demand render loop. It frames the camera (`framing.ts`), advances the controller and the layout, rotates and tips the globe, eases the reveal-in and calls the marker projector.
- `GlobeLayout.ts` carries the measured globe position and size from the DOM to the scene. When the layout cell changes (for example the whole hero becoming the frame as a project opens), the globe glides to it instead of jumping.
- `framing.ts` places the camera. At zoom 0 the whole globe fills the layout cell; at zoom 1 the camera moves in, the globe leans further and a lens shift puts the planet's centre below and left of the cell, so the planet rises from the bottom-left corner with its edge running diagonally and the selected place near that edge. A wide cell (the project page's half-width, half-height globe) moves the planet a little further right and higher, blended in by the cell's aspect so the globe never jumps while the cell glides, and phones use their own placement, so the place stays on screen.
- `GlobeController.ts` owns the orientation logic: drag with inertia, smooth focus transitions and the zoom (0 overview, 1 close-up). The close-up is switched on only while a project page is open; the zoom stays out while a turn has more than about 0.45 rad to go and moves in once the place is close. It takes time as an argument and has no React or three.js dependency. It still supports an automatic spin, which the page leaves off: the globe follows the strip instead.
- `Earth.tsx` draws the planet in two passes over one sphere: the far hemisphere first, faintly, then the near side, which writes depth so markers, borders and routes behind the planet stay hidden although the oceans are see-through. The land is a flat, dark tone from a land mask, kept dim so the project locations draw the eye. `shaders.ts` also adds the selected country's soft cyan glow from a highlight mask.
- `CountryBorders.tsx` draws coastlines and land borders as plain one-pixel grey lines (about 75,000 segments, so wide lines for all of them would cost frames while the globe moves), and the selected country's outline in cyan with a set pixel width (`LineSegments2` from three's examples). The glow around it is not a wide line, whose overlapping segments would flare at every joint, but a band the Earth shader finds in a texture holding the country and a blurred copy of it (`createHighlightTexture`).
- `OfficeMarkers.tsx` draws the studios as still red dots; their "ID-Indetails" labels are DOM elements placed by the marker projector.
- `MarkerBeacons.tsx` draws a small blue dot with two rippling rings for each place; the selected place is larger and brighter. Projects within about 10 km of each other (the same town) share a place (`groupByLocation`). A place with a close neighbour is drawn smaller, down to 30% (`markerScales` in `lib/geo.ts`), so several projects in one small country stay apart instead of running into one blot. `Routes.tsx` draws faint dashed great-circle arcs along a minimum spanning tree of the places (`minimumSpanningTree` in `lib/geo.ts`). Ripples and route flow stop when motion is paused or reduced (`effectUniforms.ts`).
- `MarkerProjector.ts` places the invisible marker buttons over the dots once per rendered frame and hides those past the horizon.
- The selected place has a type tag (`TypeTag` in `GlobeStage.tsx`): its kind of project, or kinds ("Villa · Hotel"), in blue above and to the left of its point, with a thin pointer and arrowhead to it. It moves to the right (`tagSide` in `lib/geo.ts`) when an office lies a little west of the place, where the office's label would be in the way. The tag is hidden in a project's close-up, where the project's own title is.
- `Dust.tsx` and `Starfield.tsx` are the particles around the globe and the stars behind it; `FallbackEarth.tsx` is the graticule globe shown if the mask cannot load.
- `useCountryData.ts` loads the country outlines outside React Suspense so failure can be shown in the page, draws the land mask onto a canvas and disposes it on unmount. `lib/countries.ts` decodes the outlines, finds the country a place is in (with a nearest-outline fallback for islands too small for the map) and turns lines into segments on the sphere.

**`src/hooks`** has `useProjects` (the projects, from the API), `useSiteContent` (everything else the API sends; each part that fails is logged and stays empty), `useSiteRoute` (the page and the open project in the address bar), `useMediaQuery` (including reduced motion) and `useCrossfade`.

## Behaviour

- **Landing.** The globe shows every project. The strip shows only those marked for it (`showInConveyor`), in their set order, at most 20; if none are marked, the first 20 stand in so it is never empty. The globe sits on the left, the strip right beside it, and the caption on the far right names the current project (on narrow screens the strip runs sideways below the globe, with the caption under it). The selected project's country border glows cyan. The strip starts drifting straight away, about eight seconds per project, lingering as each card passes the centre; new projects arrive from the top. The globe turns to each project as it becomes current. A turn of under 3°, between places close together, gets a small push (`GlobeController.nudge`): the globe sways about a degree past the place and settles back, so the move still shows.
- **Every project under the globe.** Below the globe and the strip, every project (not just the strip's) is in a grid of cards, 12 to a page, with numbered pages under it. Above it are a search (title, client, city and country, ignoring case and accents), filters for type, status, year and country (each offering only the values the projects have), a sort (newest, oldest, title; newest first by default) and a Clear filters button; changing any of them goes back to the first page. The filters and the page live in the address (`/?type=villa&year=2024&page=2`), so a filtered list can be shared and is still there after opening a project and coming back. From a project opened here that is not in the strip, Previous and Next move through every project rather than the strip's. While the grid is in view the strip stops drifting and the globe stops drawing. The dropdowns are fully styled where the browser supports it (`appearance: base-select`, in current Chrome and Edge); elsewhere the closed control matches and the open list is the browser's own.
- **Choosing.** The strip can be scrolled with the wheel or trackpad, dragged and flung; the Previous and Next buttons and the Left and Right arrow keys step through projects. After any of these the drift waits about six seconds, then carries on. It also waits while the mouse rests on the strip. The strip loops forever. The Pause button stops the drift and the ripples.
- **Opening a project.** Clicking a card in the strip or the grid, a blue dot on the globe or View project opens that project, whether or not it is one of the strip's. The strip and the caption fade out, and the project's photograph fades back in on the right half of the page; the planet glides into the left half, leaning so its edge runs diagonally, turns to the place and moves in, with the project's title at the top left of it. The two halves sit side by side with a 10 px gap, and each is half the screen's height (320 to 640 px), right under the header, which stays in view; the page scrolls to the top when a project opens. On narrow screens there is no room beside the globe, so the globe fills the screen and the photograph opens the page below instead. The project page follows directly under the two halves, so its description (in the same small type as the facts) and the key facts show on the first screen, then the project's concept (pictures and text, when it has one), then its photos in columns of varying heights, an enquiry prompt and the previous and next projects. Clicking a photo opens it full screen over the page: Previous and Next, the Left and Right arrow keys or a swipe move through the photos (wrapping round at either end), the row of small photos below jumps straight to any one, and Escape, the close button or a click beside the photo closes it, returning focus to the photo that opened it. While it is open the arrow keys and Escape belong to it, so they don't change or close the project. Previous and next keep the close-up and turn the globe to the new place. All projects, the wordmark or Escape go back; the globe zooms out and the strip returns at the same project.
- **Pages and addresses.** The site has five kinds of address: `/` (the globe and the grid), `/projects/<slug>`, `/studio`, `/contact` and `/privacy` (the privacy notice, linked from the footer and the cookie question). The page never reloads: moving between them uses the History API, so links can be shared and the browser's Back and Forward buttons move between them with the same animations. Moving between projects replaces the entry, so Back always returns to where the first project was opened from, scrolled to where it was left (for example the same place in the grid). An unknown address falls back to the globe. The old projects page, `/projects`, now opens the home page scrolled down to the grid, keeping any filters in its address (`/projects?type=villa` becomes `/?type=villa`). A project address that matches no project (for example an old link to a project that has since been renamed) keeps its address and shows a "Project not found" page with a link to the grid. The globe stays mounted, hidden and idle, behind the other pages, so it is ready the moment you come back.
- **Contact form.** Name, email and message are required; phone is optional. Mistakes are shown beside each field and the first one is focused; corrected fields clear as you type. A valid message is sent to the API, which emails it to the studio. Fields the server rejects are shown beside them the same way; too many messages, sending switched off or any other failure ends with a note saying so, and asking the visitor to email or call instead where the site has an email or phone numbers to offer.
- **Cookie question.** In a build with a Google Analytics measurement ID, a first visit asks whether the site may use Google Analytics cookies, with Accept and Decline side by side; the page stays usable behind it. The answer is kept in the browser for a year, so the question isn't asked again on every visit; "Cookie settings" in the footer (and on the privacy page) asks it again, and declining after accepting removes Google Analytics' cookies. A browser sending Global Privacy Control is never asked and never counted. Without an ID there is no question and no tracking.
- **Keyboard and screen readers.** The strip and the globe markers are pointer-only (`aria-hidden`, `tabIndex={-1}`); the caption's View project button and the Previous and Next buttons reach every project, and a live region announces the current one. The skip link jumps to the main content of whichever page is showing.
- **Reduced motion.** With `prefers-reduced-motion` the strip does not drift and jumps instead of gliding, the globe jumps to each place and in and out of the close-up, the ripples are replaced by a still ring and the page transitions are near-instant.
- Without WebGL 2 the globe is replaced by a notice and the strip and project pages keep working. If the country outlines fail to load, a graticule globe is shown with a notice.
- **Offices.** Red points mark the studios the API lists, each labelled ID-Indetails. They do not move and cannot be clicked.
- **Nothing entered yet.** Parts with no content are left out: the services list, the studio addresses, phones and maps, the email line, the footer's social links and the red points. The favicon stays the site's own until one is chosen.
- **Under construction.** A switch in the app's Website area (`underConstruction` in `GET /settings`) puts the site under construction: every address except Contact and Privacy shows a single page (`components/UnderConstruction.tsx`) with a strip of construction tape, a short line and a Contact us link. The header keeps only the logo, the footer drops its Studio link, and the globe isn't loaded. Until the settings answer, those pages wait (an empty page), so the full site never flashes first. The API caches the settings for a minute, so a switch can take that long to show. An API that doesn't send the flag counts as switched off.

## Analytics

Google Analytics 4, through Google's tag (`gtag.js`), loaded by `src/analytics/analytics.ts` and only after the visitor accepts ("basic" consent mode: nothing reaches Google before that). Advertising consent is always denied, and Google signals and ad personalisation are off. The API reads the numbers back for the app's Website area (`docs/website.md` in the API repository, "Analytics", which also lists every setting to make in Google Analytics).

- **Page views:** the site sends them itself (`send_page_view: false`), one per page: when the path changes, after the page's title is set (a project's waits for the projects to load). The same path again is the same page, so typing a search or changing a filter on the grid, paging it, or the skip link count nothing. Only the path is sent; on the page a visit lands on, its campaign tags (`utm_*`, `gclid`, `gbraid`, `wbraid`) too, read before the grid tidies the address. In Google Analytics, "Page changes based on browser history events" must be off, or every search typed on the grid would count as page views.
- **Events** (`AnalyticsEvents` in `analytics.ts` lists every parameter, none of which can hold what a visitor typed or a contact detail):

  | Event | When | Parameters |
  |---|---|---|
  | `generate_lead` | The API accepted a contact message (not when the hidden robot field is filled in) | `lead_source: contact_form` |
  | `email_click` | The studio's email link, on the contact page or in the form's failure note | `link_location` |
  | `phone_click` | A studio's phone number, in the contact details or on its office card | `link_location`, `office_city` |
  | `contact_cta_click` | "Contact us" on a project page or the Studio page | `cta_location`, `project_slug` |

  `generate_lead`, `email_click` and `phone_click` are marked as key events in Google Analytics. Outbound links (the social links, Open in Google Maps) are counted by Google's enhanced measurement.
- **The measurement ID** (`G-…`) is set at build time by `VITE_GA_MEASUREMENT_ID` (see `.env.example`). The Publish workflow passes the repository variable `GA_MEASUREMENT_ID`; development, CI and preview builds have none.
- **The privacy notice** (`components/PrivacyPage.tsx`) is a draft: the company's details at the top of the file (`NOTICE`) are placeholders, shown in brackets, to fill in before the site goes live.

## The website API

Everything comes from the public endpoints under `/api/public/website` (anonymous; JSON in camelCase, lists in display order, errors as `ApiErrorResponse`):

| Call | Function in `api/website.ts` | Used for |
|---|---|---|
| `GET /projects` | `getProjects` | The globe, the strip, the grid and the project pages (including the optional `conceptDescription` and up to five `conceptImages`; missing means none) |
| `GET /locations` | `getLocations` | The red points on the globe, the Studio page and the Contact page |
| `GET /services` | `getServices` | The Studio page's "What we do" |
| `GET /contact` | `getContactInfo` | The email on the Contact page, offered when the form can't send |
| `GET /social-links` | `getSocialLinks` | The footer |
| `GET /settings` | `getSiteSettings` | The favicon (PNG, JPEG or WebP), and whether the site is under construction |
| `POST /contact-messages` (202) | `postContactMessage` | The contact form |

The contact form sends a hidden honeypot field, `website`; the API quietly drops messages where it is filled in.

Besides 202 and a 400 with field errors, the contact form can get:
- 429 `too_many_requests`: five messages an hour per visitor.
- 503 `website_contact_unavailable`: no company email is set, and the API has no fallback address.
- 503 `email_delivery_failed`: the mail server failed.

The contact email and the favicon are `null` until they are set in the dashboard. The contact page then shows no email, and the site keeps its own icon. The full contract is `docs/website.md` in the API repository. Image paths come back root-relative to the API (`/api/public/website/files/42`) and are resolved against `VITE_API_BASE_URL` when the API is on another origin.

`VITE_API_BASE_URL` (see `.env.example`, read at build time) sets where the API is; by default it is `/api/public/website` on the site's own origin. In production the container's nginx forwards that path to the API.

In development, `npm run dev` (and `npm run preview`) forward `/api/public/website` to the local API at `https://localhost:7187` (the API's "https" launch profile, whose development certificate isn't checked), so nothing done locally touches the live site (`vite.config.ts`). Start the API first, or the pages say the projects couldn't load. `DEV_API_TARGET` in `.env` points it elsewhere, such as `http://localhost:5164` (the API's "http" profile) or the live site, `https://id-indetails.com`, to see the real projects; a message sent from the local contact form then reaches the company's real inbox.

## Hosting

Because the addresses are real paths (`/studio`, `/contact`, `/projects/<slug>`), the web server must answer any unknown path with `index.html` (the usual single-page-app fallback). Vite's dev and preview servers already do this, and so does the container below. The site expects to be served from the root of its domain.

### The container

`Dockerfile` builds the site with Node and serves it from an unprivileged nginx on port 8080 (`deploy/nginx.conf`):

- Files that exist are served; every other address gets `index.html`.
- `/api/public/website/` is proxied to the API container (`http://api:8080`, resolved per request through Docker's DNS), so the browser stays on one origin. Every other `/api/` path answers 404: nothing else of the API is reachable through the website.
- Headers: a Content Security Policy (the site itself, the Google Maps embeds, and Google Analytics' tag and measurement hosts), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. The hashed bundles in `/assets/` are cached for a year and the page itself is never cached, so a new deployment shows at once.
- `GET /healthz` answers `ok` for the container's health check.
- It runs read-only with `--tmpfs /tmp`. TLS is handled in front of it (Caddy on the server).

```bash
docker build -t id-indetails-website .
```

```bash
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp id-indetails-website
```

## CI and deployment

**CI** (`.github/workflows/ci.yml`) runs on pull requests to `master` and on `master` after a merge, except for Markdown-only changes and pushes with `[skip ci]`:

1. The Dockerfile's `check` stage: `npm run typecheck`, `npm run lint` and `npm test`.
2. The runtime image is built and started read-only with no capabilities, and checked: healthy, not root, every page address answers with the app, a static file is served as itself, a missing bundle is a 404, the private API is not reachable, the security headers are present and caching is right.
3. A Trivy scan fails on fixable critical or high vulnerabilities.

The actions are pinned to commits, as in the backend.

**Publishing and deploying** (`.github/workflows/publish.yml`) is started by hand (Actions → Publish → Run workflow):

- It builds with the Google Analytics measurement ID from the repository variable `GA_MEASUREMENT_ID` (Settings → Secrets and variables → Actions → Variables). Without the variable the image tracks nothing.

- It runs the checks, then pushes `ghcr.io/mohammadrstm/id-indetails-website:sha-<7>`.
- With **deploy** ticked, and after a reviewer approves the `production` environment, it logs the server in to GHCR, sets `WEBSITE_TAG` in the server's `.env` and restarts only the `website` service. It reads the API's and the client's image tags from the server's `deployed.env`, which the API's deploy writes, because the compose file needs every tag; so the API must have been deployed at least once.
- Giving **tag** deploys an image published earlier without building, for a rollback.

Deploying needs the server side first. Hosting is not decided yet, so none of this is in place:

- A `website` service in the server's `docker-compose.prod.yml`: `image: ghcr.io/mohammadrstm/id-indetails-website:${WEBSITE_TAG}`, on the same network as the `api` service, read-only with a `/tmp` tmpfs.
- A Caddy site for the website's domain, forwarding to `website:8080`.
- If the website's nginx reaches the API, its network must be in the API's `Proxy:KnownNetworks`, so the API's rate limits see visitors rather than nginx.
- The repository's `production` environment with the same secrets as the backend's deploy (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`) and, if it differs, the `DEPLOY_PATH` variable (default `/opt/id-indetails`).

## Assets and licences

Country outlines come from Natural Earth (public domain) at 1:50m scale, via the `world-atlas` package (`countries-50m.json`, emitted as a static asset and fetched at runtime) and decoded with `topojson-client`.


The font is Archivo Variable, via `@fontsource-variable/archivo`, under the SIL Open Font License 1.1.

The logo is the split "0" from the studio's PNG mark, redrawn as vector shapes without its black square so it sits directly on the page and stays sharp at any size: `LogoMark` in `components/icons.tsx` (header and footer, in the text colour) and `public/favicon.svg` (the browser tab, dark on light browser themes and white on dark ones) hold the same shapes.

## Testing

`npm test` runs Vitest over the pure logic: `lib/geo.ts` (coordinate maths, focus orientation, grouping, marker sizes, which side the type tag goes), `lib/countries.ts` (decoding the real outlines, finding each project's and office's country, rings across the antimeridian, holes, segment building), `globe/GlobeController.ts` (damping, focus, shortest yaw path, drag inertia, the close-up zoom, reduced motion), `hooks/useSiteRoute.ts` (reading and writing every kind of address, and where a page was left), `lib/projectFilters.ts` (the grid's search, filters, sorting and their address form), `lib/conveyor.ts` (which projects the strip shows), `lib/gallery.ts` (stepping through a project's photos, and setting them out in columns), `lib/pagination.ts` (the grid's pages and their address form), `api/` (reading the API's replies and errors against a stubbed `fetch`) `lib/contactForm.ts` (the form's checks), `analytics/` (nothing loaded or sent before Accept or without an ID, one page view per page, cleaned addresses, events, a change of mind removing the cookies, Global Privacy Control, and the kept answer) and `data/contactSource.ts` (that it posts to the API and passes its errors on). The tests that need projects and offices use made-up ones in `src/test/projects.ts`. Test files live next to the code as `*.test.ts` and are type-checked by `tsconfig.test.json`.

## Protecting the photos

The site makes its photos awkward to save, as a deterrent:
- right-clicking a photo offers no "Save image as" or "Copy image", and photos can't be dragged out of the page (`lib/protectPhotos.ts`, set up in `main.tsx`);
- a long press on a phone offers no save menu (`-webkit-touch-callout: none` on `img`);
- a printed page leaves the photos out.

None of this stops a determined visitor. Whatever a browser shows has already reached their device (the network panel and the cache have it), and screenshots and phone cameras can't be blocked by any website. The real protection is on the server: serving the public site only reduced copies, never the originals, and watermarking those copies.

## Known limitations

- The Google maps load when the Contact page's maps come into view, whatever the visitor answered to the cookie question, and Google may set its cookies; the privacy notice says so. Loading them only after consent would need a click-to-load placeholder.
- The privacy notice's company details are placeholders (`NOTICE` in `components/PrivacyPage.tsx`).
- The sun is fixed relative to the camera, so the lit face is a stylised look, not the real time of day.
- The globe's code (three.js and React Three Fiber, about 750 kB, 200 kB gzipped) loads as its own chunk after the site's code (`globe/preload.ts`), but it is still one large chunk and Vite warns about its size.
- The 3D view needs WebGL 2. Without it, only the strip, captions and project pages are available.
- If the graphics driver drops the WebGL context, the page shows a notice and needs a reload.
- While the ripples play, the globe renders every frame; it stops when motion is paused or the globe is scrolled out of view.
