# client-web

Static frontend (HTML/CSS/JS single-page app) for the Casa de Stella Client System,
served by Cloudflare Pages at https://stella-catering-82j.pages.dev/. The API it calls
(`/api/*`) is the Cloudflare Worker in `backend/`.

The first commit of this folder is the build that was live on 2026-11-11, pulled from
the deployment so the repository matches what is running. Later commits apply the
Phase 3 UX refinements (B-01 to B-11, except B-06).

Deploy: upload this folder as the Pages project's static assets (no build step).
