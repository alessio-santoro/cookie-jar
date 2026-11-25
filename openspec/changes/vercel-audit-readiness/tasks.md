# Tasks

## 1. Protected preview and fixture restriction

- [ ] 1.1 Create a separate public, static-only Vercel fixture project with deterministic dummy cookies and no scanner API or secrets; verify the fixture URL is reachable without a bypass credential and returns the expected test cookies.
- [ ] 1.2 Restrict preview audit requests to the exact fixture URL and reject every other destination before browser startup; verify with API tests that the fixture is accepted and a non-fixture URL is rejected without launching Chromium.
- [ ] 1.3 Configure and deploy a Vercel preview for the API and packaged Chromium after the fixture-only restriction is in place, with preview access protection enabled; verify an unauthenticated request cannot reach the audit API.
- [ ] 1.4 Add and document a deployment-only readiness check that reports whether required namespace tools and operations are available without exposing environment details; verify it runs only in the protected preview and does not permit arbitrary target URLs.

## 2. Verify browser and network isolation in Vercel

- [ ] 2.1 Exercise the deployed namespace boundary and verify the browser has only loopback, no external route, and must use the destination-policy proxy; verify private destinations, redirects, subresources, WebSockets, and CONNECT attempts are blocked or revalidated.
- [ ] 2.2 Launch packaged Chromium in the deployed Function with its native sandbox enabled and no sandbox-disabling flags; verify a failed sandbox launch returns a structured unavailable error and never falls back to an unprotected browser.
- [ ] 2.3 Run the fixture-only audit through the deployed API and verify the expected cookie metadata is returned without cookie values; verify responses remain non-cacheable and reports redact query strings and fragments.

## 3. Confirm deployment limits and readiness

- [ ] 3.1 Measure the actual deployed function bundle, included browser dependencies, cold/warm startup, peak memory, response size, and execution duration; verify each fits the selected Vercel plan with cleanup and error-response headroom.
- [ ] 3.2 Record the protected-preview results and remaining blockers in the README; verify documentation does not claim public scan readiness unless every browser, network, packaging, and resource gate passed.
- [ ] 3.3 Enable public destinations only after all preview gates pass, then verify the production API can complete a bounded audit while preserving the same isolation checks; if any gate fails, leave live checks unavailable and record the deployment blocker.
