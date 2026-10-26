# Design


## Context

See [proposal.md](proposal.md) for motivation and capability scope. The workspace currently contains only OpenSpec scaffolding and its generated Copilot setup workflow. There is no application, dependency manifest, test suite, deployment configuration, or visual identity to preserve. Java 17, Maven 3.9.9, Node 22, and npm are available locally; Docker availability has not been checked.

The user confirmed React/Vite/TypeScript, developers/site owners as the primary audience, REVIEW for unknown cookies, and public HTTP(S)-only scanning. Existing generated workflow files remain untouched unless directly needed for application validation.

## Goals / Non-Goals

**Goals:**
- Keep browser execution out of Vercel and maintain a small typed HTTP boundary.
- Make failure, observation limits, unknown classifications, and blocked traffic visible.
- Establish deterministic test seams without weakening production destination policy.
- Ship a single-worker MVP with predictable resource consumption.

**Non-Goals:**
- No database, job broker, browser pooling, accounts, consent interaction, or legal rules engine.
- No numeric compliance percentage: categorical evidence cannot justify one.
- Do not equate CORS with API authentication or SSRF protection.

## Decisions

### 1. Two independent application roots

Use `backend/` with Maven and a supported Spring Boot release compatible with Java 17, and `frontend/` with React, Vite, TypeScript, and Tailwind. Pin dependency versions and commit the frontend lockfile. Use Java records for immutable transport data and Lombok only where it improves internal boilerplate.

This avoids a Node browser worker contrary to the requested Java architecture. Next.js would add server functionality the client-only frontend does not need. A monorepo orchestrator would add unnecessary machinery for two independently deployed applications.

### 2. Synchronous API with a confined browser lifecycle

Separate controller/validation, target policy, browser runner, classifier, and report assembly. A nonblocking permit rejects excess work immediately. Run each admitted audit in a supervised execution unit with a hard 35-second budget and process termination on overrun; an HTTP timeout or Java interrupt alone is not sufficient to stop Chromium.

Keep every Playwright object on its owning execution thread. Use try-with-resources/finally and ensure termination of the worker process tree on budget expiry. Release the permit only once the prior execution has stopped. Process readiness must fail if execution cannot be safely recovered.

A shared browser or an asynchronous job API would complicate isolation and lifecycle management. Starting an isolated browser per scan is slower but appropriate for this MVP.

### 3. Explicit observation protocol

Launch headless Chromium with a fresh nonpersistent context, fixed documented viewport/locale, no stored authentication, and no user interaction. Block service workers so request interception cannot be bypassed. Navigate with DOM-content-loaded and a 20-second limit; reject main-document HTTP errors. Attempt network idle for 3 seconds, record timeout as a warning, wait another 2 seconds, then snapshot `context.cookies()`.

The 35-second overall budget also covers launch and cleanup. Popups must not broaden the single-page audit: close/block them and record a warning. Browser version and settings affect results and belong in documentation. A bounded observation is more reliable than waiting indefinitely for idle on ad-heavy sites.

### 4. Public-only egress is a layered boundary

Validate URI structure, scheme, default port, credentials, length, and every resolved address for the initial URL. Reuse the same policy for redirects and routed requests. Explicitly test special-use IPv4/IPv6 ranges and mixed answers rather than relying only on Java's local-address helpers.

Application-level DNS checks are defense in depth, not a complete SSRF solution. Provide a controlled outbound HTTP(S) proxy path for Chromium that resolves names, rejects non-public answers, and connects to the validated numeric address rather than resolving again. Reject private CONNECT targets, enforce default ports, apply the same checks to HTTP and WebSocket upgrades, and handle IPv6 and DNS failures fail-closed. Disable implicit browser proxy bypass in production.

Deploy the browser with network rules denying direct egress except to that proxy; deny metadata/internal destinations at the network boundary as well. Proxy DNS must use an explicitly permitted resolver. This prevents alternate browser traffic and rebinding from bypassing request routes. Document an enforceable reference topology and verify it with adversarial tests before calling deployment publicly ready. Host selection can vary, but the boundary cannot be omitted.

Tests can inject a narrowly scoped fixture-only policy/proxy permitting a named local fixture. Do not add a general production `allowPrivateNetworks` switch. CORS never relaxes this policy.

### 5. Dictionary-backed classification with honest uncertainty

Store versioned signatures as data or a small declarative rule list, including category, provider, matching mode, and rationale. Prefer exact matching over anchored prefixes; reject ambiguous duplicate rules in tests. Start with `_ga`, `_ga_`, `_gid`, and `_fbp` and add a small explicitly documented set of supported essential signatures only where justified. Unknown names remain Unclassified.

The dictionary is heuristic evidence, not proof of a cookie's purpose. Even an Essential signature can be reused by a site; expose that limitation. Derive outcome once on the backend: Analytics/Marketing implies FAIL, else unknown implies REVIEW, else PASS.

### 6. Stable evidence-only transport

The report has this shape; names and enums are shared by frontend types and API fixtures:

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

Use null provider/signature for unknown cookies and null expiry for session cookies; convert persistent epoch seconds to UTC instants. Sort cookies deterministically by domain, name, then path. Never include cookie values. Return structured `{code, message, requestId}` errors through centralized exception handling; log diagnostics with the request identifier while redacting target query strings and browser exception text that could contain secrets.

### 7. Task-focused frontend

Use one React page with a labeled form and mutually exclusive idle, pending, error, and success states. Keep the successful report associated with the submitted URL, not the subsequently edited input. Hide stale reports on new submission. A fetch timeout longer than the backend budget aborts stalled client requests; distinguish network, validation, capacity, unsafe-target, and timeout failures.

Validate response structure at the API boundary instead of type-casting untrusted JSON. Render summaries and warnings before the cookie table. Provide visible focus, live status announcements, readable timezone-aware expiry, text category badges, and a horizontally scrollable table region on narrow screens.

Visual identity is not yet approved. During apply, record confirmed product context and obtain one compact visual-direction approval before UI edits; do not fabricate brand assets, customer claims, or populated audit results. Choose accessible typography/contrast and restrained task-oriented components rather than a decorative marketing page.

### 8. Deployment and documentation

Use a multistage backend Dockerfile with a Java build stage and a browser-ready runtime. Match the Playwright Java version and installed Chromium version; run non-root with supported sandbox settings and document host requirements. Do not silently add `--no-sandbox` as a portability workaround.

Configure port and exact allowed frontend origins via environment variables; no wildcard credentials. Use a lightweight health endpoint with execution-subsystem readiness. Vercel uses `frontend/` as root, its production build output, and a public backend-base-URL build variable. The backend remains an independently hosted HTTPS service.

Document local setup, environment examples without secrets, request/response examples, limitations, public-exposure checklist, rate limiting at ingress, egress topology, memory/CPU expectations measured during smoke testing, and host/proxy timeout requirements.

## Risks / Trade-offs

- [Dictionary false positives/negatives] -> Expose matched signatures, keep unknown cookies reviewable, and avoid legal-certification language.
- [Timing, browser policies, geography, or bot detection alter cookies] -> State the fixed protocol and observation limitations; test with controlled fixtures rather than live-site expectations.
- [Untrusted web execution and DNS rebinding] -> Patched browser, non-root runtime, sandbox verification, validated-address proxy, and network-enforced egress.
- [Browser startup overhead or stalled processes] -> Single admission permit, hard execution budget, process cleanup tests, and readiness failure if recovery is unsafe.
- [Container-host networking restrictions] -> Validate the reference isolation topology; do not advertise unrestricted public readiness on an incompatible host.
- [Synchronous connection timeout] -> Keep browser work bounded and configure frontend/ingress timeouts above that budget.
- [Local fixture access could weaken public-only policy] -> Restrict injected exceptions to the test fixture and prove production defaults reject them.

## Migration Plan

1. Scaffold and validate each application independently, then run deterministic API/browser and UI tests.
2. Run the local full-stack fixture flow and container browser smoke test.
3. Configure the backend host, safe egress topology, ingress abuse controls, HTTPS, resource limits, and exact frontend origins.
4. Build/deploy the Vercel frontend against that backend and verify CORS and a permitted public target.
5. Roll back by disabling the audit endpoint or reverting the deployment; no persistent application data requires migration.
