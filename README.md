# CookieJar

A privacy-focused website checker with a JavaScript scaffold and a local-only
controlled browser experiment. The public API does not run scans yet. Deployment,
network safety, and the consumer interface remain unverified or unimplemented.

## Requirements

- Node.js 22 (22.17 or newer within that major version)
- npm

No Java, Maven, TypeScript, Vercel account, or separate browser download is needed
for local validation. The browser experiment uses the packaged Linux Chromium
binary and requires a compatible Linux environment/system libraries; it was
verified on Linux x64. If using nvm, run `nvm use` from the repository root.

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
They also launch the packaged Chromium twice against an owned loopback fixture
and verify actual HTTP-only and JavaScript cookies in fresh contexts.
`npm run build` writes the frontend to `dist/`; the Node API is not bundled into
the browser assets. The local preview command serves that build and uses the
same development API adapter. A static host alone cannot execute the API.

## Local browser feasibility experiment (task 1.2, partially verified)

```sh
npm ci
npm run spike:browser
```

The command runs [the server-only spike](server/browser-spike.js) twice in one
process. Each run creates a short-lived HTTP server on an OS-assigned loopback
port with a unique fixture path, launches a fresh Chromium, visits that exact
fixture, and closes the browser and server. The fixture sets an HTTP-only cookie
by response header and another cookie in page JavaScript. A consent button is
left untouched. The command checks cookie values internally against a unique
per-run marker but never includes those values in its output.

There is **no URL input or private-network bypass switch**. Page request routing
allows only the owned fixture and blocks page WebSockets. This is a deliberately
local test exception, **not** the enforced egress boundary required for public
scanning. The CLI is not reachable through `/api/audit`, which stays disabled.

JSON output records the runtime and dependency versions, installed package sizes,
browser version, binary preparation/startup timing, cookie metadata, Node RSS,
browser-parent RSS on Linux, and serialized per-run result size. Failures produce
an explicit diagnostic and nonzero exit status; tests do not skip a failed launch.

### Observed local results

Measured on 2026-10-27, Linux x64, Node 22.23.4:

| Measurement | First in process | Repeat in process |
| --- | ---: | ---: |
| Packaged browser | Chromium 153.0.8010.0 | Chromium 153.0.8010.0 |
| Binary preparation | 757 ms | 0 ms |
| Browser launch/connect | 214 ms | 23 ms |
| Capture duration before teardown | 1053 ms | 95 ms |
| Node RSS at capture | 216,883,200 bytes | 217,145,344 bytes |
| Browser-parent RSS at capture | 186,396,672 bytes | 186,093,568 bytes |
| Serialized result, before its size field | 535 bytes | 531 bytes |
| Initial cookies / captured cookies | 0 / 2 | 0 / 2 |

Pinned `@sparticuz/chromium` **153.0.0** occupies **70,091,665 bytes** installed;
`playwright-core` **1.63.0** occupies **13,453,369 bytes** installed. The latter's
bundled browser metadata targets Chromium 153. Package-directory sizes exclude
other dependencies and are **not a Vercel function bundle measurement**.

These are observations, not performance guarantees. First/repeat runs are not
Vercel cold/warm invocations, and binary preparation can reuse OS temporary files
from an earlier process. RSS samples are not browser-tree peak memory or the
deployment's billed memory. The serialized result is not an API report or HTTP
response. Capture duration excludes teardown. The command labels all these limits.

**Isolation finding:** the packaged Chromium arguments include `--no-sandbox`.
This local trusted-fixture check does not demonstrate safe isolation for
untrusted websites, and that flag must not be described as a sandboxed browser.
No public scan or isolation/network gate has passed.

### Blocked deployment verification

Task 1.2 remains unchecked: this checkout has no linked/authenticated Vercel
project and no selected plan. Per the approved local-only scope, no preview was
deployed and no deployment settings, cost, or protection configuration was assumed.
The following measurements are still missing:

- Protected Vercel preview and deployment identifier.
- Actual packaged function size and deployed dependency inclusion.
- Genuine cold/warm invocations, platform response size, startup, and memory.
- The intended plan's confirmed resource limits and protected-preview settings.

To resume, authenticate Vercel locally (never paste credentials into chat), identify
the project/team and plan, and authorize its protected preview. Deployed testing
must remain fixture-only until the later network/isolation gates pass. The local
CLI is the reproducible local command, **not** a claim of a completed deployed
verification or an unrestricted scan endpoint.

## Scope and next steps

- One root npm project: React source in [src/](src/), server-only function in
  [api/](api/), and scaffold tests in [test/](test/).
- Plain JavaScript/JSX, ESLint, and Node's built-in test runner.
- The page is an unstyled placeholder, not the approved consumer UI.
- No public scanning, cookie classification, persistence, or mock findings.
- Tailwind and component test tooling belong to task 5.1.
- Vercel browser deployment and public-only network protection remain unverified.
  Public scanning must stay disabled until all feasibility and release gates pass.

See the approved [proposal](openspec/changes/bootstrap-cookiejar-mvp/proposal.md),
[design](openspec/changes/bootstrap-cookiejar-mvp/design.md), and
[tasks](openspec/changes/bootstrap-cookiejar-mvp/tasks.md).
