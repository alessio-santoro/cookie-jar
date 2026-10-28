# Tasks

## 1. Local feasibility gate

- [x] 1.1 Scaffold one root JavaScript npm project with React/Vite, a server-only Node.js audit entrypoint, ESLint, test/build scripts, and a committed lockfile; verify installation, the initial build, a smoke test, and local routing to `/api/audit` without Java or TypeScript prerequisites.
- [x] 1.2 Implement the minimal Playwright/Chromium spike and verify real cookies from a controlled allowed target; record dependency versions, response size, memory, and startup time, and document the reproducible command. (A protected Vercel preview deployment was also completed earlier; it is kept as a data point and is not required going forward.)
- [ ] 1.3 Demonstrate an enforceable public-only network boundary locally; verify denial of non-public IPv4/IPv6, mixed answers, DNS rebinding, private redirects/subrequests/sockets, and direct-connection bypass attempts using protected local listeners, and document the actual mechanism (e.g. a loopback validating proxy with direct resolution/connection blocked) rather than treating initial DNS checks as sufficient.
- [ ] 1.4 Verify per-audit browser isolation, deadline/process-tree cleanup, concurrent-audit independence, launch flags, and absence of application secrets in the browser environment; record measured evidence and fail the gate if the isolation or 35-second execution budget cannot be met.
- [ ] 1.5 Confirm all local browser/network gate evidence before starting group 2, and record the Vercel-specific questions deferred to the deployment stage (serverless Chromium packaging, platform egress, ingress rate limits, spending controls, provider logs); if any local gate fails, pause for an explicit architecture decision without silently changing scope.

## 2. Findings contract and classification

- [ ] 2.1 Implement shared JavaScript report validation and request/error fixtures matching the design contract; verify tests for enums, arrays, null provider/signature/session expiry, UTC timestamps, category-count consistency, malformed responses, and exclusion of cookie values.
- [ ] 2.2 Implement dictionary rules, exact-before-prefix matching, provider/signature evidence, stable ordering, counts, and FAIL/REVIEW/PASS precedence; verify `_ga`, `_ga_*`, `_gid`, `_fbp`, justified Essential entries, unknowns, near misses, duplicate rules, zero cookies, and every outcome.
- [ ] 2.3 Document the report shape, signature coverage/uncertainty, consumer outcome mapping, and scope of the tool's fresh visit; verify examples against the shared fixtures and ensure no guarantee of website safety, actual cookie intent, or legal compliance.

## 3. Complete browser observation and destination policy

- [ ] 3.1 Extend the gate's destination policy with URL normalization, length/credential/default-port restrictions, and safe rejection codes across every browser request surface; verify malformed URLs, DNS failure, mapped IPv6, special-use ranges, mixed answers, redirects, and production rejection of narrowly scoped test-fixture exceptions.
- [ ] 3.2 Complete clean-context observation with documented viewport/locale, blocked service workers/popups, 20-second DOM deadline, three-second idle attempt, two-second observation, final URL, and warnings; verify real-browser fixtures for HTTP-only, JavaScript, delayed, session/persistent, cross-origin, and duplicate-name cookies, including an untouched consent button.
- [ ] 3.3 Complete per-process single-browser admission, 429 retry semantics, 35-second overall deadline, cancellation, owned-process teardown, and recovery; verify stalled launch/navigation, concurrent requests, timeout cleanup, and a subsequent successful scan without shared state.
- [ ] 3.4 Document local browser installation, isolation settings, the verified local egress mechanism, timing, test-only fixture injection, and observation limits; verify the documented browser-test command and explain why the scan does not inspect the person's own browser or all tracking.

## 4. Same-origin API and privacy handling

- [ ] 4.1 Complete `POST /api/audit` in the Node.js handler (Vercel-compatible shape, mounted locally by Vite) with JSON/method/origin validation, report validation, safe errors, and request IDs; verify route tests for malformed input, unsafe targets, target errors, capacity/deadline errors, unknown failures, disallowed origins, and unsupported methods without wildcard CORS.
- [ ] 4.2 Add no-store responses, sanitized diagnostics, and no report persistence; verify query tokens, cookie values, and raw browser exception URLs do not appear in application logs or reports, and note that hosting-provider request/access logging is reviewed in the deployment stage.
- [ ] 4.3 Document relative API calls, one-project local startup, request examples, error/retry behavior, and the difference between process availability and browser readiness; verify examples against the running API without a frontend backend-URL variable.

## 5. Consumer React interface

- [ ] 5.1 Add Tailwind and component test tooling to the existing JavaScript React scaffold, record the confirmed privacy-conscious audience, and obtain compact visual-direction approval before UI edits; verify the approved concept prioritizes understandable findings and includes no invented trust claims.
- [ ] 5.2 Implement relative `/api/audit` integration with runtime response validation, a 70-second client timeout, abort handling, and readable failure messages; verify tests for valid reports, non-JSON platform errors, malformed contracts, 400/429/502/504 responses, and timeout without a fabricated success.
- [ ] 5.3 Build the accessible website-address form with "Check website", validation, keyboard submission, pending announcements, duplicate prevention, retry, and safe-link guidance; verify edited URLs, stale-result suppression, success-followed-by-failure, and pending controls in component tests.
- [ ] 5.4 Build plain-language outcome headings, category explanations, counts, warnings, capture metadata, and fresh-visit limitations; verify all three headings, zero cookies, unknown-only cookies, matched providers, and absence of complete-safety, personal-browser, or numerical-score claims.
- [ ] 5.5 Add responsive cookie evidence with Name, Domain, Category, Expiration, discoverable provider/path, session explanations, and timezone-aware dates; verify long content, session/persistent expiry, keyboard detail access, and mobile table behavior.
- [ ] 5.6 Document interface/local commands and inspect desktop/mobile, keyboard, 200% zoom, contrast, focus, live status, and reduced motion in a bounded visual pass; verify lint, unit/component tests, and the production build, and correct discovered defects.

## 6. Local release readiness

- [ ] 6.1 Ensure `npm run build` plus `npm run preview` serve the UI and real audit endpoint on one local origin with no backend-host variable, client secrets, or API fallback interception; keep `vercel.json` and the Vercel-shaped `api/audit.js` untouched in behavior.
- [ ] 6.2 Write the local run guide and a deferred-deployment checklist listing what the Vercel stage must still verify (serverless Chromium packaging, platform egress enforcement, cold starts, ingress rate limits, spending controls, provider logs, rollback); verify it does not describe the app as publicly ready or claim any Vercel result is verified.

## 7. Full-stack acceptance (local)

- [ ] 7.1 Run the UI-to-same-origin-API-to-Chromium fixture flow for FAIL, REVIEW, PASS, delayed cookies, and zero cookies; verify actual captured evidence matches the consumer headings/details and no consent interaction occurs.
- [ ] 7.2 Run local controlled-target checks for unsafe redirects/subrequests, DNS rebinding, concurrent audits, timeout/recovery, invalid responses, and origin denial; verify no protected connection succeeds, no cross-audit state leaks, and every failure is visible.
- [ ] 7.3 Run the documented install, lint, unit/component/browser tests, and build commands from a clean checkout; verify the results reproduce without a separate host, repository, or Vercel account.

## Workflow follow-up

- Review the implementation and verification evidence before archiving the change.
- Vercel deployment is out of scope for this change. Plan it as a separate change (serverless Chromium, platform egress enforcement, rate/spend controls, protected preview, release checklist) after local acceptance.
- Do not enable public scanning until that deployment change passes every gate; local success is not deployment evidence.
- If a local gate fails, present the measured limitation and obtain approval before considering an external browser, container, or different host.
