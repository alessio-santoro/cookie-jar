# Tasks

## 1. Single-project Vercel feasibility gate

- [x] 1.1 Scaffold one root JavaScript npm project with React/Vite, a server-only Node.js audit entrypoint, ESLint, test/build scripts, and a committed lockfile; verify installation, the initial build, a smoke test, and local routing to `/api/audit` without Java or TypeScript prerequisites.
- [ ] 1.2 Implement the minimal Playwright/serverless-Chromium spike and deploy it to a protected Vercel preview; verify real cookies from a controlled allowed target on cold and warm invocations, record dependency versions, bundle size, response size, memory, startup time, and the intended plan's limits, and document the reproducible command.
- [ ] 1.3 Demonstrate an enforceable public-only network boundary in the selected Vercel setup; verify denial of non-public IPv4/IPv6, mixed answers, DNS rebinding, private redirects/subrequests/sockets, and direct-connection bypass attempts using protected listeners, and document the actual mechanism rather than treating initial DNS checks as sufficient.
- [ ] 1.4 Verify per-audit browser isolation, deadline/process-tree cleanup, concurrent-instance independence, launch flags, and absence of application secrets in the browser environment; record measured evidence and fail the gate if the isolation or 35-second execution budget cannot be met.
- [ ] 1.5 Verify available Vercel ingress rate controls and spending/usage safeguards for the intended plan, document their semantics and costs, and confirm all browser/network gate evidence before starting group 2; if any gate fails or requires another service/runtime/host, pause for an explicit architecture decision without silently changing scope.

## 2. Findings contract and classification

- [ ] 2.1 Implement shared JavaScript report validation and request/error fixtures matching the design contract; verify tests for enums, arrays, null provider/signature/session expiry, UTC timestamps, category-count consistency, malformed responses, and exclusion of cookie values.
- [ ] 2.2 Implement dictionary rules, exact-before-prefix matching, provider/signature evidence, stable ordering, counts, and FAIL/REVIEW/PASS precedence; verify `_ga`, `_ga_*`, `_gid`, `_fbp`, justified Essential entries, unknowns, near misses, duplicate rules, zero cookies, and every outcome.
- [ ] 2.3 Document the report shape, signature coverage/uncertainty, consumer outcome mapping, and scope of the tool's fresh visit; verify examples against the shared fixtures and ensure no guarantee of website safety, actual cookie intent, or legal compliance.

## 3. Complete browser observation and destination policy

- [ ] 3.1 Extend the gate's destination policy with URL normalization, length/credential/default-port restrictions, and safe rejection codes across every browser request surface; verify malformed URLs, DNS failure, mapped IPv6, special-use ranges, mixed answers, redirects, and production rejection of narrowly scoped test-fixture exceptions.
- [ ] 3.2 Complete clean-context observation with documented viewport/locale, blocked service workers/popups, 20-second DOM deadline, three-second idle attempt, two-second observation, final URL, and warnings; verify real-browser fixtures for HTTP-only, JavaScript, delayed, session/persistent, cross-origin, and duplicate-name cookies, including an untouched consent button.
- [ ] 3.3 Complete per-instance single-browser admission, 429 retry semantics, 35-second overall deadline, cancellation, owned-process teardown, and recovery; verify stalled launch/navigation, concurrent requests, timeout cleanup, and a subsequent successful scan without shared state.
- [ ] 3.4 Document local browser installation, production package/isolation settings, the verified egress mechanism, timing, test-only fixture injection, and observation limits; verify the documented browser-test command and explain why the scan does not inspect the person's own browser or all tracking.

## 4. Same-origin API and privacy handling

- [ ] 4.1 Complete `POST /api/audit` in the Vercel Node.js function with JSON/method/origin validation, report validation, safe errors, and request IDs; verify route tests for malformed input, unsafe targets, target errors, capacity/deadline errors, unknown failures, disallowed origins, and unsupported methods without wildcard CORS.
- [ ] 4.2 Add no-store responses, sanitized diagnostics, and no report persistence; verify query tokens, cookie values, and raw browser exception URLs do not appear in application logs or reports, and document separately what Vercel request/access logging can retain.
- [ ] 4.3 Document relative API calls, one-project local startup, request examples, error/retry behavior, and the difference between function availability and browser readiness; verify examples against the running API without a frontend backend-URL variable.

## 5. Consumer React interface

- [ ] 5.1 Add Tailwind and component test tooling to the existing JavaScript React scaffold, record the confirmed privacy-conscious audience, and obtain compact visual-direction approval before UI edits; verify the approved concept prioritizes understandable findings and includes no invented trust claims.
- [ ] 5.2 Implement relative `/api/audit` integration with runtime response validation, a 70-second client timeout, abort handling, and readable failure messages; verify tests for valid reports, non-JSON platform errors, malformed contracts, 400/429/502/504 responses, and timeout without a fabricated success.
- [ ] 5.3 Build the accessible website-address form with "Check website", validation, keyboard submission, pending announcements, duplicate prevention, retry, and safe-link guidance; verify edited URLs, stale-result suppression, success-followed-by-failure, and pending controls in component tests.
- [ ] 5.4 Build plain-language outcome headings, category explanations, counts, warnings, capture metadata, and fresh-visit limitations; verify all three headings, zero cookies, unknown-only cookies, matched providers, and absence of complete-safety, personal-browser, or numerical-score claims.
- [ ] 5.5 Add responsive cookie evidence with Name, Domain, Category, Expiration, discoverable provider/path, session explanations, and timezone-aware dates; verify long content, session/persistent expiry, keyboard detail access, and mobile table behavior.
- [ ] 5.6 Document interface/local commands and inspect desktop/mobile, keyboard, 200% zoom, contrast, focus, live status, and reduced motion in a bounded visual pass; verify lint, unit/component tests, and the production build, and correct discovered defects.

## 6. One-project release configuration

- [ ] 6.1 Finalize root Vercel build/output/API routing, supported Node runtime, packaged browser assets, server-only settings, and a 60-second function maximum; verify a protected preview serves the UI and real audit endpoint on the same origin with no backend-host variable, client secrets, or API fallback interception.
- [ ] 6.2 Enable and test the verified ingress rate controls and provider spending safeguards; document actual plan requirements, resource measurements, cold starts, per-instance versus deployment-wide limits, and rollback, and verify excess requests cannot start browser work.
- [ ] 6.3 Write the public-release checklist covering passed browser/network gates, privacy/provider-log settings, consumer caveats, HTTPS, rate/budget settings, and rollback; verify it does not mark an untested preview as publicly ready or claim scanning is unlimited/free.

## 7. Full-stack acceptance

- [ ] 7.1 Run the UI-to-same-origin-API-to-Chromium fixture flow for FAIL, REVIEW, PASS, delayed cookies, and zero cookies; verify actual captured evidence matches the consumer headings/details and no consent interaction occurs.
- [ ] 7.2 Run deployed controlled-target checks for cold/warm behavior, unsafe redirects/subrequests, DNS rebinding, concurrent instances, timeout/recovery, invalid responses, and origin denial; verify no protected connection succeeds, no cross-audit state leaks, and every failure is visible.
- [ ] 7.3 Run the documented install, lint, unit/component/browser tests, build, and protected Vercel smoke commands; verify the persistent project reproduces the results without a separate host or repository, leaving any environmental/deployment blocker explicitly unfinished.

## Workflow follow-up

- Review the implementation and verification evidence before archiving the change.
- Enable public scanning only after the single-project deployment passes every gate and release check; missing Vercel access or plan capabilities are blockers, not grounds to mark verification complete.
- If feasibility fails, present the measured limitation and obtain approval before considering Vercel containers, another Vercel service, an external browser, or a different host.
