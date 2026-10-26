# Tasks

## 1. Backend foundation and report contract

- [ ] 1.1 Scaffold the Java 17 Maven/Spring Boot backend with Web, validation, Lombok, Playwright Java, test dependencies, and externalized port/settings; verify the application compiles and a context-startup test passes.
- [ ] 1.2 Define immutable request, report, cookie, summary, observation, and error models matching the design contract; verify serialization tests cover all enums, empty arrays, null session expiry, and exclusion of cookie values.
- [ ] 1.3 Implement dictionary rules, exact-before-prefix matching, provider/signature evidence, deterministic ordering, category counts, and outcome precedence; verify tests for `_ga`, `_ga_*`, `_gid`, `_fbp`, essential/unknown entries, near misses, duplicate rule rejection, zero cookies, and every outcome.
- [ ] 1.4 Document the JSON contract, dictionary coverage, signature uncertainty, and observation limits; verify documented JSON against the serialization test fixtures.

## 2. Public destination and egress boundary

- [ ] 2.1 Implement shared URL and DNS/address policy, normalization, credential/default-port restrictions, and safe error codes; verify tests for malformed URLs, mixed DNS answers, failures, IPv4/IPv6 special ranges, mapped addresses, and public destinations.
- [ ] 2.2 Provide the validated-address outbound proxy path with fail-closed resolution and numeric-address connections for HTTP, HTTPS CONNECT, and WebSocket upgrades; verify public routing and denial of private targets, DNS rebinding, malformed authorities, and prohibited ports.
- [ ] 2.3 Provide an enforceable reference browser/proxy network topology and isolated test fixture policy; verify direct browser egress is denied, production rejects local fixtures, and test exceptions cannot enable arbitrary private destinations.
- [ ] 2.4 Document egress configuration, metadata/internal-network protection, default-port restrictions, DNS behavior, and supported deployment prerequisites; verify the reference setup commands and explicitly identify hosts that cannot satisfy isolation.

## 3. Browser observation and execution lifecycle

- [ ] 3.1 Implement the isolated Playwright runner with nonpersistent context, documented viewport/locale, blocked service workers/popups, shared target policy, egress proxy configuration, bounded DOM/idle waits, and two-second observation; verify real-browser fixtures for HTTP-only, JavaScript, delayed, session, persistent, cross-origin, and duplicate-name cookies without consent interaction.
- [ ] 3.2 Implement request routing and redirect/subrequest warnings with distinct unsafe-main-target failures; verify private redirects, resource requests, sockets, and popup attempts cannot reach protected fixture listeners.
- [ ] 3.3 Implement single-audit admission, supervised hard execution deadline, browser-process cleanup, permit recovery, and execution-subsystem readiness; verify overload rejection, stalled launch/navigation termination, cleanup after failure, and successful subsequent scans.
- [ ] 3.4 Document browser installation, sandbox requirements, timing protocol, limitations, and test-fixture execution; verify the documented browser test command on a clean test profile.

## 4. REST API and cross-origin integration

- [ ] 4.1 Implement `POST /api/audit`, input validation, centralized safe error responses, request correlation, redacted logging, and status mapping; verify controller tests for valid reports, malformed input, unsafe targets, target HTTP errors, busy/timeout states, and unexpected worker failures.
- [ ] 4.2 Add exact-origin configurable CORS and lightweight health/readiness endpoints; verify allowed/disallowed preflights, no wildcard credentials, prompt health responses during scans, and unhealthy execution-subsystem behavior.
- [ ] 4.3 Document local backend startup, environment variables, request examples, retry semantics, and privacy behavior; verify examples against the running API and prove query tokens/cookie values do not appear in application logs.

## 5. React frontend

- [ ] 5.1 Scaffold React/Vite/TypeScript, Tailwind, lint/type-check/build scripts, and component test tooling with a committed lockfile; verify dependency installation, initial production build, and a smoke component test.
- [ ] 5.2 Record the confirmed audience/product constraints and obtain compact visual-direction approval before UI edits; verify the approved direction preserves the task-focused form/dashboard scope and makes no invented claims.
- [ ] 5.3 Implement typed runtime-validated API integration, configurable backend base URL, timeout/abort handling, and readable backend/network/invalid-response errors; verify API tests for valid reports, non-JSON responses, malformed contracts, 400/429/502/504 errors, and timeout.
- [ ] 5.4 Build the accessible URL form with keyboard submission, validation, mutually exclusive state handling, pending announcements, duplicate prevention, and retry; verify component tests include edited URLs, stale-result suppression, success-followed-by-failure, and disabled pending controls.
- [ ] 5.5 Build the summary and responsive cookie table with all categories/outcomes, warnings, URLs, capture metadata, provider/path, expiry, and scope caveats; verify component tests for PASS/REVIEW/FAIL, zero cookies, long content, and timezone/session formatting.
- [ ] 5.6 Document frontend environment/startup/Vercel build settings and inspect desktop/mobile, keyboard, 200% zoom, contrast, focus, status announcements, and reduced motion; verify lint/type-check/tests/build pass and fix defects found in a bounded visual check.

## 6. Deployment preparation

- [ ] 6.1 Create the multistage non-root backend Dockerfile and build-context exclusions with matching Playwright/Chromium dependencies, configurable port, and supported sandbox execution; verify image build, container health, and a real-cookie browser smoke test.
- [ ] 6.2 Add frontend Vercel configuration as needed and safe environment examples; verify a production build points to the configured HTTPS backend without secrets or localhost references.
- [ ] 6.3 Document backend host requirements, enforced egress reference deployment, exact CORS origins, ingress rate limits, HTTPS, resource measurements, timeout alignment, health checks, and rollback; verify the deployment checklist distinguishes local readiness from safe public exposure.

## 7. Full-stack acceptance

- [ ] 7.1 Run the frontend-to-backend-to-Chromium controlled-fixture flow for FAIL, REVIEW, PASS, delayed cookies, and zero cookies; verify actual captured JSON matches the rendered dashboard and no fixture consent button is activated.
- [ ] 7.2 Run cross-layer failure/recovery checks for unsafe redirects/subrequests, DNS rebinding, concurrent scans, stalled scans, invalid responses, and denied CORS origins; verify no protected network connection succeeds, errors remain visible, and capacity recovers.
- [ ] 7.3 Run backend verification, frontend lint/type-check/tests/build, and the container smoke check using documented commands; verify persistent source/configuration changes reproduce the passing results and record any genuine environmental blocker without marking its task complete.

## Workflow follow-up

- Review the implementation and verification evidence before archiving the change.
- Deploy only after the chosen host satisfies the public-exposure checklist; supplying deployment credentials or creating cloud resources is outside the bootstrap.
