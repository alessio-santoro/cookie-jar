# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The workspace contains OpenSpec planning and generated workflow files, not an implemented application. No application code or production deployment needs migration.

The primary audience is ordinary internet users concerned about privacy and tracking; developers and site owners are secondary users. The immediate target is a locally runnable plain-JavaScript React/Vite application and Node.js API. The existing Vite adapter provides same-origin local routing. Vercel remains a possible later deployment target, but no provider, plan, or deployment is required to develop the application. Unknown cookies still require REVIEW, and live scans remain public HTTP(S)-only.

The local controlled-browser spike demonstrates fixture cookie capture, not safe arbitrary-URL scanning or deployment readiness. Build and validate the application locally against the owned fixture; keep arbitrary live scans disabled until local browser isolation and an enforceable public-only egress boundary have passed. Existing generated workflow files remain untouched unless directly needed for application validation.

## Goals / Non-Goals

**Goals:**
- Explain what was observed, why it matters, and what remains unknown without requiring cookie expertise.
- Develop and run the UI and API together locally without a Vercel account, project, plan, or separate backend.
- Keep JavaScript approachable while validating untrusted data and testing behavior.
- Prove local browser compatibility and bounded resource use; prove local public-only network enforcement before enabling live scans.
- Preserve a path to verify deployment-specific constraints later without making them prerequisites for local development.

**Non-Goals:**
- No database, job broker, persistent worker, accounts, consent interaction, browser extension, or legal rules engine.
- No access to the visitor's existing browser cookies, history, login sessions, or extensions.
- No numeric privacy/compliance percentage or claim that no cookies means no tracking.
- Do not equate same-origin routing, HTTP request interception, or initial DNS checks with complete network enforcement.
- No Vercel deployment, provider-plan selection, or deployment-wide abuse/cost configuration is required during local application development.

## Decisions

### 1. One locally runnable JavaScript application

Use one root npm project with a React/Vite UI in `src/`, a Node.js API handler at `api/audit.js`, server-only scanning code outside the client import tree, and small shared classification/report-validation modules where appropriate. Use `.js`/`.jsx`, Tailwind, ESLint, and tests; optional JSDoc improves editor hints without requiring TypeScript or a type-check build step. Commit the lockfile and pin compatible browser/automation versions.

The browser calls relative `/api/audit`; local Vite development routes that path to the same Node handler on the same origin. SPA fallback rules must not swallow API routes. Keep this handler compatible with a possible later Vercel deployment, but do not require Vercel tooling or deployment to build and test local features.

Next.js would also provide React and same-origin routes, but is unnecessary for one client page and one endpoint. Spring Boot would retain two languages and a separately managed runtime, which is not the simplest fit. Neither is the selected implementation.

### 2. Local browser verification before live scans

Use the existing local Playwright/Chromium spike and its owned loopback fixture to verify actual HTTP-only and JavaScript cookie capture in fresh contexts. This check supports local application development; it does not verify safe arbitrary-URL scanning or a future deployment.

Develop report validation, classification, local API contracts, and UI behavior against controlled fixtures while live arbitrary-URL scans remain disabled. Integrate the live scanner only after local browser isolation, deadlines, cleanup, and an enforceable public-only egress boundary have been verified for the initial target, redirects, subresources, sockets, and DNS changes. If local enforcement cannot be demonstrated, keep live scans disabled and request an architecture decision rather than relying on URL validation or page-level routing alone.

Vercel bundle size, cold/warm invocation behavior, function limits, and plan-specific controls are deployment-stage checks. A local pass does not satisfy those checks; perform them only if Vercel is selected for deployment.

### 3. Synchronous API and per-audit lifecycle

Separate request validation, target policy, browser execution, classifier, and report assembly. Return the report in the request; no database or job queue is needed. Launch a distinct browser and fresh context for each audit, even on a reused function instance. Never reuse a browser profile or cookie jar between requests.

Use an application execution deadline of 35 seconds including launch, capture, and teardown, subject to local measurement. A timeout must terminate the owned audit process tree, not just race a promise against a timer. Use `finally` cleanup and ownership-specific termination so concurrent scans cannot kill one another's processes. Set any client timeout above the application deadline. Configure a platform-specific maximum only when a deployment target is selected.

Limit each local API process to one active browser with no unbounded queue, returning 429 with `Retry-After` when occupied. This is a local resource guard, not a deployment-wide limit. For a future serverless deployment, verify per-instance semantics and configure that provider's ingress and spending controls before public release. Cancellation or client disconnect must not leave unbounded background work.

### 4. Public-only network boundary

Validate URL structure, scheme, default port, credentials, length, and every resolved address. Reject non-public IPv4/IPv6, mixed answers, and failed resolution. Reapply policy to redirects, subrequests, sockets, and popups. Keep the rejection and warning behavior specified in [audit-api](specs/audit-api/spec.md).

These checks alone are not an egress boundary: Chromium may resolve a checked hostname again, and traffic can bypass a page-level route. No local or deployment network policy has been verified for this project. Before enabling live scans from the local application, demonstrate an enforceable boundary that denies non-public connections and DNS rebinding for all browser traffic. It must prevent direct connections bypassing any validating transport, not merely log them.

Do not silently assume an independently deployed validating proxy, custom host network rules, or another operational component. If local scanning requires such a component, present the architecture and operational costs for approval. Until local enforcement is verified, arbitrary live scans are blocked; URL validation must not be advertised as complete SSRF protection.

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

### 8. Local routing and future deployment controls

Develop from the repository root as one npm project: Vite serves the UI and routes `/api/audit` to the local Node.js handler. Pin a supported Node version and verify local browser compatibility. No separately deployed backend URL, cross-origin credential setup, Java runtime, Docker worker, or external proxy host is required for local development.

Restrict the audit route to POST JSON, reject disallowed browser origins, and do not add wildcard CORS. Same-origin checks do not stop non-browser abuse. If a public deployment is later selected, verify its ingress rate limits and spending controls before unrestricted access; if the plan lacks necessary controls, obtain a decision instead of pretending a per-instance counter provides them.

Keep secrets server-side and out of the Vite client bundle. A simple availability probe is optional; do not promise persistent-worker readiness or browser functionality from a process-only health check. Use the local controlled-browser smoke test for local readiness and a separate deployed browser smoke test if a deployment is selected.

Document local install/build/test commands, browser setup, same-origin API routing, scan limitations, safe URL submission, verified local egress, and resource measurements. When a deployment target is selected, document its runtime, limits, rate/budget controls, cold-start behavior, and rollback separately. Clearly distinguish local fixture verification, protected deployment previews, and public release readiness.

### 9. Future deployment assumptions

Vercel remains a possible deployment target, not a current architectural dependency. Do not assume a plan, resource limit, ingress control, spending safeguard, or browser packaging result until a Vercel project is actually selected and measured. Any deployment-specific feasibility work belongs to the later deployment stage and does not replace local network-safety verification.

## Risks / Trade-offs

- [The local runtime cannot enforce the required browser/network isolation] -> Keep arbitrary live scans disabled and request an architecture decision; continue fixture-backed development without weakening the guarantee.
- [Local Chromium behavior or resource use is unsuitable] -> Measure locally with reproducible fixtures and keep deployment claims separate.
- [A later deployment exceeds package, startup, or memory limits] -> Measure on the selected deployment before public release; pin versions and retain reproducible fixtures.
- [A future deployment scales browser usage and cost] -> Verify provider ingress abuse and spending controls before public release; never claim an in-memory counter is a global limit.
- [Tracking findings are mistaken for a personal privacy assessment] -> Consumer-facing explanations, fresh-visit disclosure, and no safety/compliance score.
- [Dictionary, timing, geography, or bot-detection uncertainty] -> Show evidence and limits, preserve REVIEW, and use deterministic fixtures.
- [Stalled work or API errors] -> Owned-process teardown, application deadlines, no-store responses, and UI handling of non-JSON failures.
- [URLs reveal sensitive information to infrastructure or a target] -> No application report persistence, sanitized diagnostics, provider-log review, and submission guidance.
- [Test exceptions weaken production restrictions] -> Inject only named fixture allowances in tests and verify production rejects them.

## Migration Plan

1. Run the existing controlled Chromium fixture locally and keep arbitrary live scans disabled.
2. Develop report validation, classification, API behavior, and the consumer interface against local fixtures.
3. Implement and verify local browser isolation, deadlines, cleanup, and public-only egress before enabling live public-URL scans locally. If local enforcement fails, stop live scanning for an architecture decision while fixture-backed development may continue.
4. Run deterministic local full-stack tests and verify same-origin API routing and production-safe target restrictions.
5. If Vercel is later selected, verify its packaging, cold/warm behavior, resource limits, network boundary, ingress controls, and spending safeguards before public release. Deployment rollback and provider controls are handled at that stage; no database migration is required.
