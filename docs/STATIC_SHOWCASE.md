# Static production showcase

The owner's September 6, 2026 instruction changes this site to read-only browsing of real examples. Production is the `static-showcase/` directory, served by the existing Amplify app `dvk70yskzrsgb` with platform `WEB`. The domain remains `proofofconceptstudio.com`.

The pages preserve the existing site design and a bounded snapshot of its public category dashboards and latest briefs. `static-showcase-manifest.json` records the source URLs, archive date, source commit, and files. Previously published text and source links retain their original dates. A notice identifies every page as historical. Native links and disclosures support navigation without JavaScript.

The production artifact contains only HTML, CSS, images, fonts, and `robots.txt`. It has no Next.js runtime, hydration, server rendering, Lambda entrypoint, API, chat, administration, forms, scheduled refresh, credentials, or dependencies. The former application and infrastructure source remains in Git for historical reference; it is excluded from the production build. Existing backend data is not deleted by this cutover.

## Build and verify

Run `node scripts/validate-static-showcase.mjs` with Node 20 or newer. The dependency-free check validates the finite route inventory, local navigation/assets, crawling directives, absence of executable content, and absence of remote automatically loaded resources. Amplify runs this check and publishes only `static-showcase/`; it does not install packages or run the old application build.

Production settings must remain `platform=WEB`, `framework=Web`, no compute role, no application credentials, and no catch-all success rewrite. The only environment entry is the non-secret `SHOWCASE_MODE=static` marker: Amplify ignored an empty map, so this one entry replaced the former runtime credentials and monorepo setting. Unknown addresses and `/api/*`, `/chat`, `/admin`, and `/login` must return 404 or 410. The error page is `404.html`. `customHttp.yml` disallows script execution, connections and form submission, applies noindex headers everywhere, and gives content-addressed assets an immutable one-year cache. `robots.txt` disallows all crawling. These are crawler requests, not a claim that anonymous bots can be distinguished from human visitors. Static hosting transfer/storage can still have a small cost.

Release only on explicit owner changes; automatic builds and pull-request previews are disabled to avoid unsolicited build spending. Validate the public home page, both region views, a portfolio, a brief, assets, headers, and negative API/unknown routes after publishing. Confirm Amplify reports `WEB` rather than inferring static operation from the page appearance.

## Historical restore boundary

The former production source is commit `eaa93d67558c995251822be7b78fab5a124866e7`, Amplify `main` job 25. The obsolete App Runner build and redeploy workflows were disabled in GitHub and removed from the active workflow directory; Git history preserves their previous contents. Restoring the former application would intentionally re-enable paid processing and therefore requires fresh owner approval plus restoration of its separately disabled backend permissions and schedules. A routine static content correction should keep this build and hosting mode.

## Verified cutover

Amplify `main` job 27 deployed commit `d1eb168938e9362082abf07e7d0076530f19d685` successfully at `2026-09-06T17:34:07.863Z`. Build, deploy, and provider verification all succeeded. Job 26 failed before its build because it started with the former monorepo environment setting; the successful job used the corrected environment map.

Public verification checked eight normal page routes, thirteen retired or unknown routes, CSS, `robots.txt`, and a POST to `/api/chat`. Pages returned 200 with `Server: AmazonS3`, no Next.js cache header, noindex headers, and a script/connection-blocking CSP. All thirteen retired/unknown GET routes and the POST returned 404. CSS returned `public, max-age=31536000, immutable`. The live browser checked the home page, portfolio directory, both views of a portfolio, and a full brief at desktop size, plus the home page at 390px width: visible content, working navigation and native news disclosures, no horizontal overflow, no broken images, no JavaScript, no fetch/XHR, and no external automatic resource requests.

The 66 public pages comprise six directory/region/action pages, all fifteen portfolio dashboards in both regions, and thirty full briefs. The artifact contains 123 files. One image already returned 404 at its external source during capture and was omitted; its source is recorded in the manifest. Historical brief summaries remain readable, with full-detail links only for the thirty captured briefs.

Only the `main` branch exists. Its automatic builds and pull-request previews are disabled. The legacy `POCStudioAmplifyComputeRole` remains an app service-role attachment with no inline or attached policies; its CMHub read and Lambda invocation policy was removed after cutover. There is no Amplify compute-role assignment, and the hosting platform is `WEB`. This removes request-time application processing; it does not promise zero transfer charges or technically exclude every bot from a public website.

## Cloudflare Pages preparation

Cloudflare deployment is prepared separately from the active Amplify host. The archived page and asset bytes match the successful Amplify job 27; `static-showcase/_headers` is Pages-only hosting metadata. It carries the same security, noindex and cache policy as `customHttp.yml`. Keep the root `404.html`: Pages otherwise treats a site as an SPA and can return the home page for unknown routes. Do not add Pages Functions, `_worker.js`, `_redirects` catch-all rules, analytics scripts or other request-time code.

Run `node scripts/validate-static-showcase.mjs`, then upload only `static-showcase/`. The validator checks the Pages header mapping as well as the existing finite archive, immutable asset names and visit-only constraints. Pages may normalize directory URLs with a trailing slash; these remain the same archive pages.

The manual-only `.github/workflows/deploy-cloudflare-showcase.yml` publishes `main` to the `proofofconceptstudio` Pages project through pinned Wrangler 4.129.0. Configure its `Production` environment with secret `CLOUDFLARE_API_TOKEN` (scoped to Pages edit for the selected account) and variable `CLOUDFLARE_ACCOUNT_ID`. The direct-upload Pages project's production branch must be `main`. This workflow does not install the old application dependencies or run its build. Its CLI is a deployment tool; production remains static assets. There is no push, schedule or pull-request trigger, preserving owner-initiated releases.

After upload, verify the Pages URL and then both custom domains over HTTPS: normal pages/assets, noindex and CSP, cache headers, GET unknown/API/chat/admin/login routes returning 404, and POST `/api/chat` returning a non-success status. Do not retire Amplify or change DNS until that deployed acceptance passes. Existing disabled backend schedules and Lambda permissions stay disabled. No Cloudflare publication or DNS cutover is established merely by adding this configuration.

The prepared archive passed 82 HTTP checks and Chrome review at `https://de7b4087.proofofconceptstudio.pages.dev`. Custom-domain acceptance and the manual GitHub Actions release remain pending.

Provider behavior: [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [404 and URL handling](https://developers.cloudflare.com/pages/configuration/serving-pages/), [direct upload from CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
