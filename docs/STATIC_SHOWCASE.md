# Static production showcase

The owner's September 6, 2026 instruction changes this site to read-only browsing of real examples. Production is the `static-showcase/` directory, served by the existing Amplify app `dvk70yskzrsgb` with platform `WEB`. The domain remains `proofofconceptstudio.com`.

The pages preserve the existing site design and a bounded snapshot of its public category dashboards and latest briefs. `static-showcase-manifest.json` records the source URLs, archive date, source commit, and files. Previously published text and source links retain their original dates. A notice identifies every page as historical. Native links and disclosures support navigation without JavaScript.

The production artifact contains only HTML, CSS, images, fonts, and `robots.txt`. It has no Next.js runtime, hydration, server rendering, Lambda entrypoint, API, chat, administration, forms, scheduled refresh, credentials, or dependencies. The former application and infrastructure source remains in Git for historical reference; it is excluded from the production build. Existing backend data is not deleted by this cutover.

## Build and verify

Run `node scripts/validate-static-showcase.mjs` with Node 20 or newer. The dependency-free check validates the finite route inventory, local navigation/assets, crawling directives, absence of executable content, and absence of remote automatically loaded resources. Amplify runs this check and publishes only `static-showcase/`; it does not install packages or run the old application build.

Production settings must remain `platform=WEB`, `framework=Web`, no compute role, no application environment variables, and no catch-all success rewrite. Unknown addresses and `/api/*`, `/chat`, `/admin`, and `/login` must return 404 or 410. The error page is `404.html`. `customHttp.yml` disallows script execution, connections and form submission, applies noindex headers everywhere, and gives content-addressed assets an immutable one-year cache. `robots.txt` disallows all crawling. These are crawler requests, not a claim that anonymous bots can be distinguished from human visitors. Static hosting transfer/storage can still have a small cost.

Release only on explicit owner changes; automatic builds and pull-request previews are disabled to avoid unsolicited build spending. Validate the public home page, both region views, a portfolio, a brief, assets, headers, and negative API/unknown routes after publishing. Confirm Amplify reports `WEB` rather than inferring static operation from the page appearance.

## Historical restore boundary

The former production source is commit `eaa93d67558c995251822be7b78fab5a124866e7`, Amplify `main` job 25. Restoring it would intentionally re-enable a paid application and therefore requires fresh owner approval plus restoration of its separately disabled backend permissions and schedules. A routine static content correction should keep this build and hosting mode.
