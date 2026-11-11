# client-web

Static frontend (HTML/CSS/JS single-page app) for the Casa de Stella Client System,
served by Cloudflare Pages at https://stella-catering-82j.pages.dev/. The API it calls
(`/api/*`) is the Cloudflare Worker in `backend/`.

The first commit of this folder is the build that was live on 2026-11-11, pulled from
the deployment so the repository matches what is running. Later commits apply the
Phase 3 UX refinements (B-01 to B-11, except B-06).

Deploy: upload this folder as the Pages project's static assets (no build step).

## Preview without Cloudflare access

`node preview-server.js` serves this folder on port 8787 and forwards `/api/*` to the live
Worker at stella-catering-82j.pages.dev, so the refined frontend runs same-origin against the
real API and data. Open it by the machine's hostname or IP, not `localhost` or `127.0.0.1`
(`js/api.js` sends API calls to a local XAMPP path for those two hostnames).
