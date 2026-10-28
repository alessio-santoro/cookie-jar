# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The workspace contains OpenSpec planning and generated workflow files, not an implemented application. No application code or production deployment needs migration.

The primary audience is ordinary internet users concerned about privacy and tracking; developers and site owners are secondary users. The selected direction is plain JavaScript, React/Vite, and a Node.js audit handler in one repository. **Development is local-first:** the application runs and is verified entirely on a developer machine (Vite dev/preview server plus the local `/api/audit` handler and a locally installed Chromium). Deployment to Vercel is deferred to a later stage, to be planned as a separate change. The code stays Vercel-compatible (a Node.js function at `api/audit.js`, relative API calls, no host-specific assumptions) so that deferral does not force rework. Unknown cookies still require REVIEW, and scanning remains public HTTP(S)-only.

Before the Vercel stage, nothing here is evidence that Chromium, the egress boundary, or abuse/cost controls work on Vercel. Local results must not be presented as deployment verification. The earlier protected-preview spike (task 1.2) is retained as a data point only. Existing generated workflow files remain untouched unless directly needed for application validation.

## Goals / Non-Goals

**Goals:**
- Explain what was observed, why it matters, and what remains unknown without requiring cookie expertise.
- Run the complete UI and audit API locally with one command set, no second host, repository, or external browser provider.
- Keep the code structured so a later Vercel deployment (UI and API on one origin) needs configuration, not redesign.
- Keep JavaScript approachable while validating untrusted data and testing behavior.
- Prove local browser operation, public-only network enforcement, isolation, and bounded resource use before building the full experience.

**Non-Goals:**
- No database, job broker, persistent worker, accounts, consent interaction, browser extension, or legal rules engine.
- No access to the visitor's existing browser cookies, history, login sessions, or extensions.
- No numeric privacy/compliance percentage or claim that no cookies means no tracking.
- Do not equate same-origin routing, HTTP request interception, or initial DNS checks with complete network enforcement.

## Decisions

### 1. One JavaScript application, local-first

Use one root npm project with a React/Vite UI in `src/`, a Node.js audit handler at `api/audit.js` (Vercel function shape, also mounted locally), server-only scanning code outside the client import tree, and small shared classification/report-validation modules where appropriate. Use `.js`/`.jsx`, Tailwind, ESLint, and tests; optional JSDoc improves editor hints without requiring TypeScript or a type-check build step. Commit the lockfile and pin compatible browser/automation versions.

The browser calls relative `/api/audit`. Locally, the Vite dev and preview servers mount the handler through middleware (already in `vite.config.js`), so UI and API share one origin without the Vercel CLI or any account. API routes must never be swallowed by SPA fallback. A later Vercel deployment serves the same paths unchanged.

Next.js would also provide React and same-origin routes, but is unnecessary for one client page and one endpoint. Spring Boot could now run through Vercel's Beta Container Runtime/Services, but retaining two languages and a container is not the simplest fit. Neither is the selected implementation.

### 2. Local feasibility gate before full implementation

Build the smallest local JavaScript audit spike first (already present for the browser launch). Use `playwright-core` with a locally installed Chromium (Playwright-managed or system) for development. Keep `@sparticuz/chromium` available behind a launcher seam so the later Vercel stage can select it, but do not require it locally.

The local gate must prove on a developer machine:
- The local handler launches Chromium and captures real fixture cookies repeatedly within a bounded duration and memory use.
- Concurrent audits never share browser state or each other's processes, reports, or temporary profiles.
- Per-audit deadlines, cancellation, process-tree cleanup, and resource recovery work rather than merely returning an HTTP timeout.
- Browser isolation and the public-only egress requirements in decision 4 are enforceable, including adversarial requests and DNS changes.

Vercel-specific questions (function bundle size and limits, cold starts, serverless Chromium packaging, platform-enforced egress, ingress rate limiting, spending controls, provider logging) are explicitly **deferred** to the Vercel deployment stage and must be gated there. Passing the local gate is not evidence that they hold. Public scanning remains disabled until that stage passes.

If the local gate fails, stop apply with the evidence and request an architecture decision. Do not silently substitute HTTP-header-only scanning, weaken the network policy, add an external browser/proxy, or claim completion.

### 3. Synchronous API and per-audit lifecycle

Separate request validation, target policy, browser execution, classifier, and report assembly. Return the report in the request; no database or job queue is needed. Launch a distinct browser and fresh context for each audit, even on a reused function instance. Never reuse a browser profile or cookie jar between requests.

Use an application execution deadline of 35 seconds including launch, capture, and teardown and a UI timeout of 70 seconds, subject to the measured local gate. The 60-second Vercel function maximum already in `vercel.json` is kept as-is and revisited in the deployment stage. A timeout must terminate the owned audit process tree, not just race a promise against a timer. Use `finally` cleanup and ownership-specific termination so concurrent invocations cannot kill one another's processes.

Limit each process to one active browser with no unbounded local queue, returning 429 with `Retry-After` when occupied. This is a per-process resource guard, not a global semaphore; locally it also caps load on the developer machine. Deployment-wide abuse/cost management (Vercel ingress rate limiting and spending controls) is deferred to the deployment stage; do not add an external state store without approval. Cancellation or client disconnect must not leave unbounded background work.

### 4. Public-only network boundary

Validate URL structure, scheme, default port, credentials, length, and every resolved address. Reject non-public IPv4/IPv6, mixed answers, and failed resolution. Reapply policy to redirects, subrequests, sockets, and popups. Keep the rejection and warning behavior specified in [audit-api](specs/audit-api/spec.md).

These checks alone are not an egress boundary: Chromium may resolve a checked hostname again, and traffic can bypass a page-level route. The local gate must demonstrate an enforced boundary that denies non-public connections and DNS rebinding for all browser traffic, and prevents direct connections bypassing any validating transport rather than merely logging them. The candidate local mechanism is an in-process loopback validating forward proxy that resolves names itself, checks every address, and connects to the pinned validated IP, with Chromium forced through it (`--proxy-server`, host-resolver rules denying direct resolution, WebRTC/other bypass paths disabled). This is to be proven with protected local listeners, not assumed.

Whether an equivalent boundary is enforceable inside a Vercel function is unverified and deferred to the deployment stage; that stage may require a service, container topology, or plan change that must be presented for approval. Until it passes, public deployment scanning stays blocked; URL validation must not be advertised as complete SSRF protection.

Do not inject application secrets or user authentication into the browser process. Page code is untrusted. Verify the Chromium launch flags and isolation model explicitly (locally now, serverless later); do not describe a launch with `--no-sandbox` as equivalent to a sandboxed browser. If safe isolation cannot be demonstrated, the gate fails.

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

### 8. Local operation now, Vercel deployment later

For this change the deliverable is a locally runnable application: `npm install`, a documented local Chromium install, `npm run dev` (or build + `npm run preview`) serving UI and `/api/audit` on one local origin, plus lint/test/build commands. Pin a supported Node version. No separately hosted backend, cross-origin credential setup, Java runtime, Docker worker, or external proxy host is needed.

Restrict the audit route to POST JSON, reject disallowed browser origins (locally: the dev/preview origin), and do not add wildcard CORS. Keep secrets server-side and out of the Vite client bundle. A process-only health check does not prove browser functionality; use a local browser smoke test.

Vercel deployment is a later stage, planned as its own change. It will cover: the serverless Chromium launcher, function bundle/memory/duration measurements, cold starts, platform-enforced egress, ingress rate limits, spending controls, provider logging review, protected preview versus public release, and rollback. Existing Vercel artifacts (`vercel.json`, `scripts/check-vercel-preview.js`, the token-gated spike endpoint behavior) are kept untouched and are not part of the local acceptance criteria. The app must not be exposed publicly before that stage passes.

### 9. Source basis and limits of this plan

Checked on 2026-10-26:
Reference material for the deferred deployment stage:
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations): runtime resource and duration constraints; the selected plan must be checked during the gate.
- [Vercel Container Runtime](https://vercel.com/docs/functions/runtimes/container) and [Services](https://vercel.com/docs/services): Beta alternatives permit containerized/custom-runtime applications in one Vercel project. A second host is not inherently necessary for Java.
- [Sparticuz Chromium](https://github.com/Sparticuz/chromium): serverless Chromium packaging and Playwright integration; this is not a guarantee of this application's deployability or network safety.

These sources inform a candidate architecture, not a passed feasibility gate or a selected paid service.

## Risks / Trade-offs

- [Deferring Vercel hides deployment blockers (egress enforcement, Chromium packaging, limits, cost)] -> Keep Vercel-compatible structure, keep the earlier spike artifacts, and gate the deployment stage separately; never describe local results as deployment evidence or expose the scanner publicly before then.
- [Local egress boundary cannot be enforced] -> Fail the local gate and request an architecture decision; no silent reduction of guarantees.
- [Local Chromium differs from serverless Chromium] -> Isolate browser launch behind one seam and re-run the browser tests against the serverless build during the deployment stage.
- [Per-process admission only limits local load] -> Acceptable locally; deployment-wide abuse and spending controls are a deployment-stage requirement.
- [Tracking findings are mistaken for a personal privacy assessment] -> Consumer-facing explanations, fresh-visit disclosure, and no safety/compliance score.
- [Dictionary, timing, geography, or bot-detection uncertainty] -> Show evidence and limits, preserve REVIEW, and use deterministic fixtures.
- [Stalled work or platform errors] -> Owned-process teardown, early application deadline, no-store responses, and UI handling of non-JSON platform failures.
- [URLs reveal sensitive information to infrastructure or a target] -> No application report persistence, sanitized diagnostics, provider-log review, and submission guidance.
- [Test exceptions weaken production restrictions] -> Inject only named fixture allowances in tests and verify production rejects them.

## Migration Plan

1. Build and test the minimal Node/browser spike locally (done; a protected Vercel preview spike was also completed earlier and is kept as a data point).
2. Verify local isolation, private-network denial, and deadline/process cleanup. Stop for a decision if any gate fails.
3. Once the local gate passes, complete classification/report validation, API error handling, and the consumer React interface in the same project.
4. Run deterministic local full-stack tests and verify relative API routing and production-mode restrictions.
5. In a later, separate change: deploy to Vercel behind the deployment gates (serverless Chromium, egress, rate/spend controls) and only then consider public scanning. No database migration is required at any point.
