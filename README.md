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
The function only runs in a Vercel Preview deployment when both
`COOKIEJAR_SPIKE_ENABLED=true` and a preview-only `COOKIEJAR_SPIKE_TOKEN` are
configured. It also checks `VERCEL_ENV=preview`; production and local development
remain disabled. The endpoint accepts no target URL: it only invokes its own
controlled loopback fixture. Other methods return **405** with `Allow: POST`.
Unknown API routes return **404** instead of the React HTML page.

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

### Protected Vercel preview verification

The fixture API is disabled by default. To run it in a preview, first enable
deployment protection for preview deployments in Vercel project settings and
verify that an unauthenticated request is challenged or denied. Configure
`COOKIEJAR_SPIKE_ENABLED=true` and a randomly generated, private
`COOKIEJAR_SPIKE_TOKEN` with **Preview** environment scope only. Do not configure
these variables for Production or Development. The handler also requires Vercel's
`VERCEL_ENV=preview`, so setting the feature flag alone cannot enable production.

For the local measurement command to call a protected preview, enable
**Protection Bypass for Automation** in the project's Deployment Protection
settings and create a bypass secret. This project-wide secret is sent only in
Vercel's `x-vercel-protection-bypass` request header; keep it private and revoke
it after the experiment. It is separate from the endpoint's fixture token.

After deploying a protected preview, set `COOKIEJAR_PREVIEW_URL` to that
deployment's HTTPS URL and set both `COOKIEJAR_SPIKE_TOKEN` and
`COOKIEJAR_VERCEL_PROTECTION_BYPASS` in the local environment, then run:

```sh
npm run spike:preview
```

The command makes two serial requests to the fixed fixture endpoint; it never
submits or accepts a website URL. It reports browser version, browser startup and
capture timing, Node and browser-parent RSS samples, response bytes, function
uptime/invocation sequence, and cookie metadata without cookie values. Sequential
requests are not guaranteed to reach the same Vercel instance, so use the
invocation sequence together with Vercel runtime logs to establish cold/warm
behavior. RSS is a sample rather than peak memory.

#### Observed deployment results

The project owner ran `npm run spike:preview` against the protected deployment
for commit `76bac0d` on 2026-10-27. The deployment was
[`cookie-l26bbhsf7-alessio-santoros-projects-a08c92da.vercel.app`](https://cookie-l26bbhsf7-alessio-santoros-projects-a08c92da.vercel.app).
Both requests returned HTTP 200 and captured the expected HTTP-only and
JavaScript-created fixture cookies without values.

| Measurement | First request (instance invocation 1) | Second request (instance invocation 2) |
| --- | ---: | ---: |
| Browser | Chromium 153.0.8010.0 | Chromium 153.0.8010.0 |
| Client elapsed | 6,429 ms | 612 ms |
| Browser experiment duration | 3,605 ms | 295 ms |
| Chromium executable preparation | 3,176 ms | 0 ms |
| Browser startup/connect | 163 ms | 73 ms |
| Function uptime reported | 4,635 ms | 5,256 ms |
| Node RSS sample | 167,903,232 bytes | 168,845,312 bytes |
| Browser-parent RSS sample | 134,885,376 bytes | 129,421,312 bytes |
| HTTP response body | 662 bytes | 657 bytes |
| Captured fixture cookies | 2 | 2 |

Both requests reported the same function instance ID and sequential invocation
numbers. This verifies a first observed invocation followed by a warm invocation
on that instance. It does not isolate platform cold-start duration: the function
reported 4.6 seconds of uptime at the first request, and the measurements do not
include independent Vercel runtime-log evidence. RSS is sampled memory, not peak
memory or the platform's billed memory.

Pinned dependencies are `@sparticuz/chromium` 153.0.0 and `playwright-core`
1.63.0. The deployed response reports `browserSandboxDisabled: true` because the
Chromium package includes `--no-sandbox`. This fixture-only result does not
demonstrate safe isolation for untrusted websites; public scanning remains
disabled.

The project owner reported that preview deployment protection was already
enabled and the two fixture environment variables were added. The endpoint's
successful authorized responses demonstrate that the preview variables were
effective for this deployment. An unauthenticated request to the Preview was
redirected to Vercel login, independently confirming that deployment protection
challenges callers without a bypass credential.

Task 1.2 remains unchecked: the deployment proves Chromium packaging and fixture
capture, but the complete acceptance record is missing:

- Actual deployed function bundle size.
- Platform-confirmed cold-start duration and peak/billed memory.

The deployment URL above and the measured first/warm fixture calls are recorded,
but platform logs/settings are still needed to verify the remaining items. Local
results are not substitutes for these measurements, and no public scan or
isolation/network gate has passed.

The project owner reported the project is on **Hobby**. According to Vercel's
published limits as of 2026-10-27, Hobby Functions have up to 2 GB memory, a
300-second maximum duration, and a standard 250 MB uncompressed bundle limit.
This project configures `maxDuration` to 60 seconds. Hobby's published monthly
usage guidelines list 1,000,000 invocations, 4 active CPU hours, and 360 GB-hours
of provisioned memory; these are usage allotments, not measurements or guarantees
of this project's actual consumption. See Vercel's [Function limits](https://vercel.com/docs/functions/limitations)
and [Hobby fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
for current details. Neither the deployed function bundle size nor platform-billed
memory/CPU usage has been measured.

### Task 1.3 network-boundary feasibility (blocked)

No enforceable public-only egress boundary has been demonstrated for the
selected Vercel Hobby Function. The Preview endpoint still runs only its
owned loopback fixture; it does not accept a target URL. The browser spike
allows only that fixture through Playwright routing and blocks WebSockets, but
this is application-level interception, not an egress boundary: it does not
prove that Chromium, DNS rebinding, or a direct socket cannot bypass the route.
There is no outbound firewall or destination policy configured in this
repository's Vercel settings.

Vercel's published networking documentation describes the Vercel Firewall as
protecting inbound requests. Its [networking options](https://vercel.com/docs/networking)
describe Static IPs for outbound source-IP allowlisting on Pro and Enterprise,
Secure Compute for dedicated Enterprise networking, and Bring Your Own Cloud
for Enterprise workloads in a customer-owned AWS account. The [Static IPs
documentation](https://vercel.com/docs/networking/static-ips) describes
stable outbound IPs and a NAT gateway, not destination-level egress filtering.
The [Secure Compute documentation](https://vercel.com/docs/networking/secure-compute)
describes dedicated networking, static IPs, and VPC peering; it does not
document a public-only destination policy for this function. These options do
not establish that a Hobby Function can prevent connections to private
destinations.

As of 2026-10-28, the following required checks have **not** been run against
the deployed function: non-public IPv4/IPv6, mixed DNS answers, DNS rebinding,
private redirects/subrequests/WebSockets, or direct-connection bypasses using
protected listeners. The fixture-only endpoint cannot exercise those cases,
and no arbitrary-target test endpoint should be exposed to do so. Therefore
task 1.3 remains unchecked, and public scanning must remain disabled. URL
validation or Playwright request routing alone must not be described as SSRF
protection.

**Decision required:** establish with Vercel whether this project has access to
a supported, enforceable outbound destination filter, then repeat the
protected-listener tests through the deployed browser; otherwise pause for an
explicit architecture decision about a runtime/network boundary with
controllable egress. Do not silently add a proxy/service, change runtime or
host, or weaken the requirement.

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
