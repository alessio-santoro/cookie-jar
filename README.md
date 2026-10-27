# CookieJar

A privacy-focused website checker, currently at the JavaScript scaffold stage.
The app does not run scans yet. Browser execution, network safety, and the
consumer interface are separate tasks in the approved OpenSpec change.

## Requirements

- Node.js 22 (22.13 or newer within that major version)
- npm

No Java, Maven, TypeScript, Vercel account, or browser installation is needed for
this scaffold. If using nvm, run `nvm use` from the repository root.

## Local development

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. One command serves both the minimal React
page and `/api/audit` on the same origin; no backend URL variable is needed.

The local adapter in [vite.config.js](vite.config.js) invokes the same Node handler
as the future Vercel Function in [api/audit.js](api/audit.js). Restart the local
server after changing the handler. This adapter does not emulate Vercel limits,
isolation, packaging, or network enforcement.

To confirm API routing (use the actual port Vite prints):

```sh
curl -i http://127.0.0.1:5173/api/audit \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com"}'
```

The expected response is **503**, JSON code `AUDIT_UNAVAILABLE`, and a request
identifier. This is intentionally not an audit report: no target is visited.
Other methods return **405** with `Allow: POST`. Unknown API routes return **404**
instead of the React HTML page.

## Validation and build

```sh
npm run lint
npm test
npm run build
npm run preview
```

Tests start and close their own loopback Vite server on an available port. They
verify React entrypoint/JSX compilation and actual same-origin HTTP routing.
`npm run build` writes the frontend to `dist/`; the Node API is not bundled into
the browser assets. The local preview command serves that build and uses the
same development API adapter. A static host alone cannot execute the API.

## Scope and next steps

- One root npm project: React source in [src/](src/), server-only function in
  [api/](api/), and scaffold tests in [test/](test/).
- Plain JavaScript/JSX, ESLint, and Node's built-in test runner.
- The page is an unstyled placeholder, not the approved consumer UI.
- No scanning, cookie classification, persistence, or mock findings.
- Tailwind and component test tooling belong to task 5.1.
- Vercel browser deployment and public-only network protection remain unverified.
  Public scanning must stay disabled until all feasibility and release gates pass.

See the approved [proposal](openspec/changes/bootstrap-cookiejar-mvp/proposal.md),
[design](openspec/changes/bootstrap-cookiejar-mvp/design.md), and
[tasks](openspec/changes/bootstrap-cookiejar-mvp/tasks.md).
