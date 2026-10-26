# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The workspace contains OpenSpec planning and generated workflow files, not an implemented application. No application code or production deployment needs migration.

The primary audience is ordinary internet users concerned about privacy and tracking; developers and site owners are secondary users. The selected direction is plain JavaScript, React/Vite, and a same-project Node.js Vercel Function. One repository, one Vercel project, and one public origin replace the previously planned Java/backend hosting split. Unknown cookies still require REVIEW, and scanning remains public HTTP(S)-only.

This revision is a plan, not evidence that Chromium or the required egress boundary works on Vercel. Verify that first. Existing generated workflow files remain untouched unless directly needed for application validation.

## Goals / Non-Goals

**Goals:**
- Explain what was observed, why it matters, and what remains unknown without requiring cookie expertise.
- Deploy UI and API together on Vercel without a second host, repository, or external browser provider.
- Keep JavaScript approachable while validating untrusted data and testing behavior.
- Prove browser compatibility, public-only network enforcement, and bounded resource use before building the full experience.

**Non-Goals:**
- No database, job broker, persistent worker, accounts, consent interaction, browser extension, or legal rules engine.
- No access to the visitor's existing browser cookies, history, login sessions, or extensions.
- No numeric privacy/compliance percentage or claim that no cookies means no tracking.
- Do not equate same-origin routing, HTTP request interception, or initial DNS checks with complete network enforcement.

## Decisions

### 1. One JavaScript application and deployment

Use one root npm project with a React/Vite UI in `src/`, a Node.js Vercel Function at `api/audit.js`, server-only scanning code outside the client import tree, and small shared classification/report-validation modules where appropriate. Use `.js`/`.jsx`, Tailwind, ESLint, and tests; optional JSDoc improves editor hints without requiring TypeScript or a type-check build step. Commit the lockfile and pin compatible browser/automation versions.

The browser calls relative `/api/audit`; Vercel serves the static UI and invokes the API on the same origin. Local development must also route that path correctly, through the Vercel development server or an explicitly documented local adapter. SPA fallback rules must not swallow API routes.

Next.js would also provide React and same-origin routes, but is unnecessary for one client page and one endpoint. Spring Boot could now run through Vercel's Beta Container Runtime/Services, but retaining two languages and a container is not the simplest fit. Neither is the selected implementation.

### 2. Feasibility gate before full implementation

Build the smallest deployable JavaScript audit spike first. Use `playwright-core` with a compatible `@sparticuz/chromium` distribution in the Node.js runtime, not Edge. Use a locally installed development Chromium where needed; package the production binary/dependencies into the function rather than relying on a separately hosted browser or arbitrary runtime download.

The gate must prove on the intended Vercel plan/deployment:
- The deployed function includes all required assets, launches Chromium, and captures real fixture cookies on cold and warm invocations within bundle, memory, file-descriptor, response-size, and duration limits.
- Concurrent invocations never share browser state or each other's processes, reports, or temporary profiles.
- Per-audit deadlines, cancellation, process cleanup, and resource recovery work rather than merely returning an HTTP timeout.
- Browser isolation and the public-only egress requirements in decision 4 are enforceable, including adversarial requests and DNS changes.
- Ingress abuse controls and budget settings are available on the intended plan, with documented usage limits and cost exposure.

Vercel documentation currently lists a standard 250 MB uncompressed Node function limit and 2 GB Hobby memory; limits and paid/Beta options can change. Record the actual selected plan's limits and measured artifacts. Do not assume historical ten-second defaults, unlimited free scanning, or a locally passing browser test proves deployment compatibility.

If the gate fails, stop apply with the evidence and request an architecture decision. Do not silently substitute HTTP-header-only scanning, weaken the network policy, add an external browser/proxy, move to another host, or claim completion. Vercel Container Runtime or an isolated Vercel execution service are possible separately approved alternatives, not automatic fallbacks.

### 3. Synchronous API and per-audit lifecycle

Separate request validation, target policy, browser execution, classifier, and report assembly. Return the report in the request; no database or job queue is needed. Launch a distinct browser and fresh context for each audit, even on a reused function instance. Never reuse a browser profile or cookie jar between requests.

Use an application execution deadline of 35 seconds including launch, capture, and teardown; configure the function for a 60-second platform maximum and the UI for a 70-second timeout, subject to the measured gate. A timeout must terminate the owned audit process tree, not just race a promise against a timer. Use `finally` cleanup and ownership-specific termination so concurrent invocations cannot kill one another's processes.

Limit each warm instance to one active browser with no unbounded local queue, returning 429 with `Retry-After` when occupied. This is a per-instance resource guard, not a global semaphore: Vercel can start additional instances. Use Vercel ingress rate limiting and spending controls for deployment-wide abuse/cost management; do not add an external state store without approval. Cancellation or client disconnect must not leave unbounded background work.

### 4. Public-only network boundary

Validate URL structure, scheme, default port, credentials, length, and every resolved address. Reject non-public IPv4/IPv6, mixed answers, and failed resolution. Reapply policy to redirects, subrequests, sockets, and popups. Keep the rejection and warning behavior specified in [audit-api](specs/audit-api/spec.md).

These checks alone are not an egress boundary: Chromium may resolve a checked hostname again, and traffic can bypass a page-level route. No Vercel network policy or privileged firewall capability has been verified for this project. The deployment spike must demonstrate a Vercel-compatible enforced boundary that denies non-public connections and DNS rebinding for all browser traffic. It must prevent direct connections bypassing any validating transport, not merely log them.

Do not carry forward the previous assumption of an independently deployed validating proxy and custom host network rules: that contradicts the new deployment requirement. Any required Vercel service, container topology, plan upgrade, or additional operational component must be presented for approval if the selected function cannot meet the boundary. Until verified, public scanning is blocked; URL validation must not be advertised as complete SSRF protection.

Do not inject application secrets or user authentication into the browser process. Page code is untrusted. Verify the serverless Chromium launch flags and isolation model explicitly; do not describe a launch with `--no-sandbox` as equivalent to a sandboxed browser. If safe isolation cannot be demonstrated, the gate fails.

Tests can inject a policy limited to a named controlled local fixture. Do not add a general production private-network bypass or an arbitrary public scan endpoint that exposes protected preview deployments.

### 5. Observation and classification

Use a fresh nonpersistent context with documented viewport/locale, no stored authentication, and no clicks, typing, or scrolling. Block service workers, prevent popups from broadening capture, and record blocked traffic. Navigate to DOM content loaded within 20 seconds, reject main-document HTTP errors, attempt network idle for 3 seconds with an explicit timeout warning, then wait 2 seconds before `context.cookies()`. All steps remain subject to the overall deadline.

Use versioned exact/anchored-prefix signatures with category, provider, and rationale. Prefer exact matches; reject ambiguous duplicate rules in tests. Include `_ga`, `_ga_`, `_gid`, and `_fbp`; only label an Essential signature where explicitly justified. Unknown names remain Unclassified, not automatically malicious or safe.

Derive the internal result once on the server: Analytics/Marketing implies FAIL, else unknown implies REVIEW, else PASS. Present the result as observed cookie evidence, not a compliance verdict.

The cookie dictionary is heuristic and names can be reused. Browser policies, geography, bot detection, site experiments, and the short observation window affect findings. This is the tool's fresh visit, not a reproduction of the user's device, account, or previous consent choices. The method does not cover local storage, fingerprinting, cookieless tracking, post-consent behavior, or other pages.

### 6. Stable evidence-only transport

Preserve this report contract across server and UI. In JavaScript, share runtime validation and representative fixtures rather than relying on static types:

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

Use null provider/signature for unknown cookies and null expiry for session cookies; convert persistent epoch seconds to UTC instants. Sort by domain, name, then path. Never return cookie values. Validate incoming requests and outgoing report shape, enum values, count consistency, timestamps, and nullability. Validate JSON again at the UI boundary; JavaScript and TypeScript both need this for untrusted responses.

Application-controlled failures return `{code, message, requestId}` with 400/429/502/504/500 status semantics from the API spec. Vercel can produce non-JSON platform errors before the handler responds; the UI must handle them without inventing a report. Set report/error responses to `Cache-Control: no-store` and do not persist reports.

Use correlated, sanitized diagnostics without logging full request URLs, bodies, cookie values, or unfiltered browser exceptions. Platform request/access logging can have different retention and redaction controls: inspect and document them rather than claiming the application controls all provider logging. Warn users not to submit private links or token-bearing URLs.

### 7. Consumer-first interface

Use a single React page with an approachable website-address form, a "Check website" button, and explicit idle/pending/error/result states. Explain up front: "See which cookies a website creates before you choose." Show real progress language, not fabricated percentages or sample results. Accept keyboard submission, retain correctable input, prevent duplicate requests, and hide stale results when a new check starts.

Lead each result with one of these human-readable headings, backed by the existing enum:

| Internal outcome | Primary heading | Explanation |
| --- | --- | --- |
| FAIL | Tracking cookies detected | Known Analytics or Marketing cookies appeared before any choice in this visit. |
| REVIEW | Some cookies are unidentified | No known tracking signatures matched, but some cookies cannot be identified. |
| PASS | No known tracking cookies observed | None matched during this visit; other tracking or later cookies can still exist. |

Explain categories in everyday language: Essential cookies are associated with basic site functions; Analytics measure visits/use; Marketing are associated with advertising; Unclassified means insufficient signature information. These are dictionary classifications, not verified intent. Explain providers as organizations associated with matched signatures, not proof that all cookie data was transmitted.

Show outcome explanation, category counts, limitations, warnings, and capture metadata before detailed evidence. Keep Name, Domain, Category, and Expiration available in a responsive table; provider, path, and technical metadata can sit in an expandable detail section. Explain a domain as the site associated with the cookie and "Session" as browser-session lifetime, not a guaranteed deletion date.

Use semantic labels/table headers, visible focus, accessible error/status announcements, color-independent findings, readable timezone-aware dates, and reduced-motion support. A labeled horizontal table-scroll region is acceptable on mobile; viewport overflow is not.

The visual world is not yet approved. During apply, record the confirmed consumer audience and get compact visual-direction approval before UI edits. Do not invent privacy certifications, customer claims, risk percentages, or complete-safety assurances.

### 8. One-origin deployment and operational controls

Deploy from the repository root as one Vercel project: Vite static output plus the Node.js function. Pin a supported Node version and verify browser compatibility with it. No separately deployed backend URL, cross-origin credential setup, Java runtime, Docker worker, or external proxy host is required by this selected direction.

Restrict the audit route to POST JSON, reject disallowed browser origins, and do not add wildcard CORS. Same-origin checks do not stop non-browser abuse; enable and test Vercel ingress rate limits and project spending controls before unrestricted public access. If the chosen plan lacks necessary controls, obtain a decision instead of pretending a per-instance counter provides them.

Keep secrets server-side and out of the Vite client bundle. A simple availability probe is optional; do not promise persistent-worker readiness or browser functionality from a process-only health check. Use the deployed browser smoke test for functional readiness.

Document one install/build/deploy flow, local browser setup, the same-origin API, scan limitations, safe URL submission, the verified egress mechanism, resource measurements, rate/budget controls, cold-start behavior, and deployment rollback. Clearly separate a protected feasibility preview from safe public release.

### 9. Source basis and limits of this plan

Checked on 2026-10-26:
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations): runtime resource and duration constraints; the selected plan must be checked during the gate.
- [Vercel Container Runtime](https://vercel.com/docs/functions/runtimes/container) and [Services](https://vercel.com/docs/services): Beta alternatives permit containerized/custom-runtime applications in one Vercel project. A second host is not inherently necessary for Java.
- [Sparticuz Chromium](https://github.com/Sparticuz/chromium): serverless Chromium packaging and Playwright integration; this is not a guarantee of this application's deployability or network safety.

These sources inform a candidate architecture, not a passed feasibility gate or a selected paid service.

## Risks / Trade-offs

- [Vercel cannot enforce required browser/network isolation] -> Fail the first gate and request an architecture decision; no silent reduction of guarantees.
- [Chromium packaging, cold starts, or memory exceed limits] -> Measure on the actual deployment before building the full app; pin versions and retain reproducible fixtures.
- [Automatic scaling multiplies browser cost] -> Per-instance admission plus tested ingress abuse and spending controls; never claim an in-memory global limit.
- [Tracking findings are mistaken for a personal privacy assessment] -> Consumer-facing explanations, fresh-visit disclosure, and no safety/compliance score.
- [Dictionary, timing, geography, or bot-detection uncertainty] -> Show evidence and limits, preserve REVIEW, and use deterministic fixtures.
- [Stalled work or platform errors] -> Owned-process teardown, early application deadline, no-store responses, and UI handling of non-JSON platform failures.
- [URLs reveal sensitive information to infrastructure or a target] -> No application report persistence, sanitized diagnostics, provider-log review, and submission guidance.
- [Test exceptions weaken production restrictions] -> Inject only named fixture allowances in tests and verify production rejects them.

## Migration Plan

1. Build and test the minimal Node/browser spike; deploy a protected Vercel preview with no unrestricted public scanner.
2. Verify packaging, cold/warm execution, isolation, private-network denial, deadline cleanup, and available abuse/cost controls. Stop for a decision if any gate fails.
3. Once the gate passes, complete classification/report validation, API error handling, and the consumer React interface in the same project.
4. Run deterministic local full-stack tests and deployed controlled-target smoke tests; verify relative API routing and production restrictions.
5. Enable public scanning only after the release checklist passes. Roll back with Vercel deployment rollback or disable scan access; no database migration is required.
