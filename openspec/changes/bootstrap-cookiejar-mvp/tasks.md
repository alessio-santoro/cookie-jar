# Tasks

## 1. Local browser readiness and live-scan safety

- [x] 1.1 Scaffold one root JavaScript npm project with React/Vite, a server-only Node.js audit entrypoint, ESLint, test/build scripts, and a committed lockfile; verify installation, the initial build, a smoke test, and local routing to `/api/audit` without Java or TypeScript prerequisites.
- [x] 1.2 Verify the local Playwright/Chromium spike against the owned fixture; confirm fresh contexts capture actual HTTP-only and JavaScript cookies on first and repeat in-process runs, record local runtime/dependency/browser measurements and their limitations, and document the reproducible command.

## 2. Findings contract and classification (fixture-backed)

- [x] 2.1 Implement shared JavaScript report validation and request/error fixtures matching the design contract; verify tests for enums, arrays, null provider/signature/session expiry, UTC timestamps, category-count consistency, malformed responses, and exclusion of cookie values.
- [x] 2.2 Implement dictionary rules, exact-before-prefix matching, provider/signature evidence, stable ordering, counts, and FAIL/REVIEW/PASS precedence; verify `_ga`, `_ga_*`, `_gid`, `_fbp`, justified Essential entries, unknowns, near misses, duplicate rules, zero cookies, and every outcome.
- [x] 2.3 Document the report shape, signature coverage/uncertainty, consumer outcome mapping, and scope of the tool's fresh visit; verify examples against the shared fixtures and ensure no guarantee of website safety, actual cookie intent, or legal compliance.

## 3. Local API contract and privacy (fixture-backed)

- [x] 3.1 Implement the local `POST /api/audit` contract with JSON/method/origin validation, report validation, safe errors, and request IDs; bind the development server to loopback by default and verify malformed requests, disallowed origins, unsupported methods, and that live targets do not launch a browser before the local safety gate passes.
- [x] 3.2 Add no-store responses, sanitized diagnostics, and no report persistence; verify query tokens, cookie values, and raw browser exception URLs do not appear in application logs or reports, and document separately what local and any selected deployment's request/access logging can retain.
- [x] 3.3 Document relative API calls, local startup, request examples, error/retry behavior, and the difference between API availability and browser readiness; verify examples against the running API without a frontend backend-URL variable.

## 4. Consumer React interface (fixture-backed)

- [x] 4.1 Add Tailwind and component test tooling to the existing JavaScript React scaffold, record the confirmed privacy-conscious audience, and obtain compact visual-direction approval before UI edits; verify the approved concept prioritizes understandable findings and includes no invented trust claims.
- [x] 4.2 Implement relative `/api/audit` integration with runtime response validation, a 70-second client timeout, abort handling, and readable failure messages; verify tests for valid reports, non-JSON platform errors, malformed contracts, 400/429/502/504 responses, and timeout without a fabricated success.
- [x] 4.3 Build the accessible website-address form with "Check website", validation, keyboard submission, pending announcements, duplicate prevention, retry, and safe-link guidance; verify edited URLs, stale-result suppression, success-followed-by-failure, and pending controls in component tests.
- [x] 4.4 Build plain-language outcome headings, category explanations, counts, warnings, capture metadata, and fresh-visit limitations; verify all three headings, zero cookies, unknown-only cookies, matched providers, and absence of complete-safety, personal-browser, or numerical-score claims.
- [x] 4.5 Add responsive cookie evidence with Name, Domain, Category, Expiration, discoverable provider/path, session explanations, and timezone-aware dates; verify long content, session/persistent expiry, keyboard detail access, and mobile table behavior.
- [x] 4.6 Document interface/local commands and inspect desktop/mobile, keyboard, 200% zoom, contrast, focus, live status, and reduced motion in a bounded visual pass; verify lint, unit/component tests, and the production build, and correct discovered defects.

## 5. Local browser observation and live-scan safety

- [ ] 5.1 Implement the local live-scan destination policy with URL normalization, length/credential/default-port restrictions, and safe rejection codes across every browser request surface; verify malformed URLs, DNS failure, mapped IPv6, special-use ranges, mixed answers, redirects, subresources, sockets, DNS changes, and rejection of test-fixture exceptions outside tests.
- [x] 5.2 Complete clean-context observation with documented viewport/locale, blocked service workers/popups, 20-second DOM deadline, three-second idle attempt, two-second observation, final URL, and warnings; verify real-browser fixtures for HTTP-only, JavaScript, delayed, session/persistent, cross-origin, and duplicate-name cookies, including an untouched consent button.
- [x] 5.3 Complete per-local-process single-browser admission, 429 retry semantics, 35-second overall deadline, cancellation, owned-process teardown, and recovery; verify isolation, launch flags, absence of application secrets in the browser environment, stalled launch/navigation, concurrent requests, timeout cleanup, and a subsequent successful scan without shared state.
- [ ] 5.4 Integrate the live scanner into the local API only after the destination and lifecycle protections pass; verify arbitrary scans stay unavailable if either gate fails and the named owned fixture remains the only test-only exception.
- [ ] 5.5 Document local browser installation, local isolation/egress settings, timing, test-only fixture injection, and observation limits; verify the documented browser-test command and explain why the scan does not inspect the person's own browser or all tracking.

## 6. Future Vercel deployment and release configuration

- [ ] 6.1 If Vercel is selected, finalize root build/output/API routing, supported Node runtime, packaged browser assets, server-only settings, and function maximum; verify a protected preview serves the UI and real audit endpoint on the same origin with no backend-host variable, client secrets, or API fallback interception, and record actual cold/warm, bundle, response, and resource measurements.
- [ ] 6.2 If a public deployment is selected, enable and test its ingress rate controls and provider spending safeguards; document actual plan requirements, resource measurements, cold starts, per-instance versus deployment-wide limits, and rollback, and verify excess requests cannot start browser work.
- [ ] 6.3 Write the public-release checklist for the selected deployment covering passed browser/network gates, privacy/provider-log settings, consumer caveats, HTTPS, rate/budget settings, and rollback; verify it does not mark an untested preview as publicly ready or claim scanning is unlimited/free.

## 7. Full-stack acceptance

- [ ] 7.1 Run the UI-to-same-origin-API-to-Chromium fixture flow for FAIL, REVIEW, PASS, delayed cookies, and zero cookies; verify actual captured evidence matches the consumer headings/details and no consent interaction occurs.
- [ ] 7.2 If deployed, run controlled-target checks for cold/warm behavior, unsafe redirects/subrequests, DNS rebinding, concurrent instances, timeout/recovery, invalid responses, and origin denial; verify no protected connection succeeds, no cross-audit state leaks, and every failure is visible.
- [ ] 7.3 Run the documented local install, lint, unit/component/browser tests, and build; if Vercel is selected, also run the protected-preview smoke commands and record any remaining deployment blocker explicitly.

## Workflow follow-up

- Review the implementation and verification evidence before archiving the change.
- Enable local live scans only after local isolation, deadline, and egress gates pass. Keep public release disabled until the selected deployment passes its own feasibility, abuse-control, and release checks.
- If local or future deployment feasibility fails, present the measured limitation and obtain approval before adding a service, browser provider, proxy, or runtime.
