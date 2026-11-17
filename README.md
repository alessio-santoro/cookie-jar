# CookieJar

A privacy-focused website checker with an accessible React interface, fixture-backed
findings dashboard, and a local-only controlled browser experiment. The public API
does not run scans yet; arbitrary live scanning and deployment remain disabled.

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
Browser code uses the relative path `/api/audit`, so local and later same-origin
requests do not need a configured backend host.

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

Malformed JSON is rejected before any browser work:

```sh
curl -i http://127.0.0.1:5173/api/audit \
  -H 'Content-Type: application/json' \
  --data '{'
```

### Request errors and retries

Application errors are JSON with a stable `code`, readable `message`, and
`requestId`; responses are not cached.

| Response | Meaning and action |
| --- | --- |
| 400 `INVALID_JSON` / `INVALID_REQUEST` | Correct the JSON or website address; do not retry unchanged. |
| 403 `ORIGIN_NOT_ALLOWED` | Submit from the same origin; repeating the disallowed request will not help. |
| 405 `METHOD_NOT_ALLOWED` | Use POST as shown above. |
| 413 `REQUEST_TOO_LARGE` / 415 `UNSUPPORTED_MEDIA_TYPE` | Send a smaller JSON request with `Content-Type: application/json`. |
| 500 `INVALID_AUDIT_REPORT` / `AUDIT_FAILED` | The executor failed or returned an invalid report; use the request ID for diagnosis and do not retry automatically. |
| 503 `AUDIT_UNAVAILABLE` | Scanning is intentionally disabled in this scaffold; retry only after an implementation change enables it. |

### API availability is not browser readiness

The local API currently validates requests and returns `AUDIT_UNAVAILABLE` for
valid checks without launching Chromium. A successful response from Vite or a
working `/api/audit` route does not mean a scan is ready. `npm run spike:browser`
separately verifies packaged Chromium against the owned local fixture; it does
not connect that browser to the API, verify public-only network enforcement, or
enable arbitrary URL scans.

## Validation and build

```sh
npm run lint
npm test
npm run test:components
npm run observe:fixture
npm run build
npm run preview
```

Tests start and close their own loopback Vite server on an available port. They
verify React entrypoint/JSX compilation and actual same-origin HTTP routing.
They also launch the packaged Chromium twice against an owned loopback fixture
and verify actual HTTP-only and JavaScript cookies in fresh contexts.
`npm run test:components` covers the form, API client, outcome summary, and
responsive cookie evidence, including keyboard focus and expiry formatting.
`npm run observe:fixture` runs the separate, owned local Chromium observation
fixture; it is not connected to the audit API and accepts no target URL.
`npm run build` writes the frontend to `dist/`; the Node API is not bundled into
the browser assets. The local preview command serves that build and uses the
same development API adapter. A static host alone cannot execute the API.

## Findings contract (fixture-backed; API not enabled)

The shared JavaScript contract and classifier are tested against
[the audit fixtures](test/fixtures/audit-contract.js). They do not enable scans:
`POST /api/audit` still returns `503 AUDIT_UNAVAILABLE`.

A successful report contains `requestedUrl`, `finalUrl`, `capturedAt`,
`durationMs`, `outcome`, `summary`, `observation`, `warnings`, and `cookies`.
Summary counts cover Essential, Analytics, Marketing, Unclassified, and total.
Cookie evidence includes its name, domain, path, category, provider, matched
signature, expiration, and secure/HTTP-only/same-site metadata. Cookie values
are never part of the report. Unknown provider/signature and session expiration
are represented as `null`. The visitor's query string and fragment are removed
from reported requested/final URLs so token-bearing links are not echoed back.

This example is the `validAuditReport` fixture and is checked by the report
validator; it is not a result returned by the disabled API:

```json
{
  "requestedUrl": "https://example.com/",
  "finalUrl": "https://example.com/",
  "capturedAt": "2026-10-26T15:00:00Z",
  "durationMs": 5420,
  "outcome": "FAIL",
  "summary": {
    "total": 1,
    "essential": 0,
    "analytics": 1,
    "marketing": 0,
    "unclassified": 0
  },
  "observation": {
    "navigationTimeoutMs": 20000,
    "networkIdleTimeoutMs": 3000,
    "settleTimeMs": 2000
  },
  "warnings": [],
  "cookies": [{
    "name": "_ga",
    "domain": ".example.com",
    "path": "/",
    "category": "ANALYTICS",
    "provider": "Google Analytics",
    "matchedSignature": "_ga",
    "expiresAt": null,
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  }]
}
```

Classifier version 1 uses exact signatures for `_ga`, `_gid`, and `_fbp`, plus
the anchored `_ga_` prefix. These are associations with Google Analytics or Meta
Pixel, not proof of a cookie's purpose or that data was transmitted. Similar
unmatched names such as `prefix_ga` and `_gaFake` stay Unclassified. The built-in
dictionary has no Essential signatures: a cookie name alone does not establish
that a cookie is necessary, so any future Essential rule needs an explicit,
documented justification.

The internal outcomes map to these user-facing headings:

| Internal outcome | Heading |
| --- | --- |
| FAIL | Tracking cookies detected |
| REVIEW | Some cookies are unidentified |
| PASS | No known tracking cookies observed |

These headings describe only observed cookie evidence. A future scan is scoped
to one fresh visit before consent interaction; it does not inspect a person's
browser, account, history, or earlier consent choices. It does not cover other
pages, post-consent behavior, local storage, fingerprinting, cookieless tracking,
or cookies created later. A classification does not establish actual cookie
intent, guarantee a website is safe, or certify legal compliance.

FAIL takes precedence when any Analytics or Marketing signature is found.
Without those signatures, REVIEW applies when any cookie is Unclassified;
otherwise the outcome is PASS.

## Report retention and operational logging

The application does not persist reports. The audit handler marks success and
error responses `Cache-Control: no-store`; on executor failures it emits only a
JSON diagnostic containing a request ID and fixed error code. It does not log
request bodies, full target URLs or query strings, cookie values, or raw
browser exceptions.

That handler behavior does not control other logging layers. The default local
setup has no reverse proxy, but Vite, terminal/debug output, or a separately
configured local proxy can retain request metadata according to its settings.
No deployment target has been selected, so no provider access/function log
retention or redaction settings have been verified. If a target is selected,
review its request/access logs and retention controls separately before release.

## Local browser feasibility experiment (task 1.2: fixture verification)

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

### Optional future deployment verification

Vercel has not been selected as a deployment target, so no account, project,
plan, or preview is required for local development. If Vercel is selected later,
verify it separately and record:

- Protected Vercel preview and deployment identifier.
- Actual packaged function size and deployed dependency inclusion.
- Genuine cold/warm invocations, platform response size, startup, and memory.
- The intended plan's confirmed resource limits and protected-preview settings.

Any deployed testing must remain fixture-only until the deployment's network and
isolation gates pass. These deployment checks are separate from local fixture
verification and do not enable an unrestricted scan endpoint.

## Scope and next steps

- The confirmed audience is privacy-conscious people without technical
  expertise. The approved visual direction is a friendly utility: bright,
  approachable colors, simple cards, and restrained rounding. The UI should
  prioritize clear observed evidence and explanations, without invented trust
  claims or scores.
- One root npm project: React source in [src/](src/), server-only function in
  [api/](api/), and scaffold tests in [test/](test/).
- Plain JavaScript/JSX, ESLint, and Node's built-in test runner.
- The website-address form, plain-language result dashboard, and responsive
  cookie evidence view are implemented in the approved friendly-utility
  direction. Local website checks remain disabled until browser isolation and
  public-only network protections are verified.
- Shared report validation and cookie classification have fixture-backed tests,
  but the API does not expose scans. There are no public scans, persistence, or
  mock findings.
- Tailwind and Vitest/Testing Library component-test tooling are configured;
  client, form, result, and evidence component tests are in place.
- Vercel browser deployment and public-only network protection remain unverified.
  Public scanning must stay disabled until all feasibility and release gates pass.

See the approved [proposal](openspec/changes/bootstrap-cookiejar-mvp/proposal.md),
[design](openspec/changes/bootstrap-cookiejar-mvp/design.md), and
[tasks](openspec/changes/bootstrap-cookiejar-mvp/tasks.md).
