# Design

## Context

See proposal.md for the product motivation and the cookie-audit spec for user-visible requirements. The current app submits a URL to a same-origin Node API. The audit executor validates a public destination, launches a fresh Chromium context behind a restricted network boundary, waits for navigation and a bounded settle period, then returns cookie metadata classified by a shared signature dictionary. The UI already displays cookie attributes and limitations.

The local live-browser path requires Linux namespaces and Chromium's own sandbox. The current host blocks Chromium's nested namespace, so live requests fail closed; no deployment target has been selected. The isolated browser, destination checks, no-store responses, URL redaction, and omission of cookie values are existing constraints to preserve.

## Goals / Non-Goals

**Goals:**
- Align the existing experience with the exact-page, pre-consent, audit-only contract.
- Make observed cookie attributes visually and verbally distinct from name-based category/provider associations.
- Keep the existing request/report flow and public-destination isolation model unless a requirement cannot be met without a contract change.

**Non-Goals:**
- Inspect or modify a visitor's browser, cookie store, account, or browsing history.
- Crawl additional pages, interact with consent controls, inspect post-consent behavior, or detect cookie reads and transmissions.
- Select or launch a public deployment, or relax security gates to make scans run on an unsupported host.

## Decisions

1. **Reuse the isolated server-side browser rather than add a browser extension.** A fresh context already supports the agreed audit-only workflow without access to a user's browsing state. An extension would change the product promise and permissions model.
2. **Treat the browser context's captured cookie metadata as the evidence boundary.** Preserve the bounded visit and report names, domain, path, expiration, Secure, HTTP-only, and SameSite attributes, but never cookie values. Do not describe this snapshot as proof of script access or network transmission.
3. **Keep signature classification explicitly heuristic.** Reuse the versioned signature dictionary; present provider/category matches as associations, and leave unmatched names unclassified. Do not infer that a cookie is essential from its name alone. Adding broader or maintained signature coverage can be evaluated separately.
4. **Use evidence-centered result wording while retaining the existing report contract where possible.** Keep summary counts and the current outcome field for compatibility within the app, but ensure user-facing headings explain the matched or unclassified evidence and do not imply that a site is safe, compliant, or free of tracking.
5. **Preserve fail-closed destination and browser protections.** Continue rejecting non-public destinations and refusing to scan when namespace, egress, or Chromium sandbox requirements fail. A supported host or deployment must be verified before claiming live scan availability; weakening isolation is not an alternative.
6. **Keep reports ephemeral.** Continue returning non-cacheable responses, omit cookie values, remove query strings and fragments from reported URLs, and avoid storing user scan history.

## Risks / Trade-offs

- [A bounded visit can miss cookies set later or by behavior not exercised during the visit] -> State the observation window and single-page/pre-consent scope in the report.
- [Cookie-name signatures can be stale or misclassify custom cookies] -> Describe matches as associations, include unknowns, and avoid definitive purpose or safety claims.
- [Some environments cannot start the required browser sandbox] -> Keep the scan unavailable with an explicit error until the runtime passes the existing isolation gates.
- [A result's internal PASS/FAIL labels can be mistaken for a site verdict] -> Use neutral, evidence-centered UI wording and explain that no known signature is not proof of no tracking.

## Migration Plan

No persisted reports or stored user data require migration. Keep the same-origin API and report shape where feasible; update UI copy and focused tests together if result wording changes. If an API contract change proves necessary, update its validator, fixtures, and client tests in the same implementation.

## Open Questions

None that block this change. Deployment selection remains outside this scope.
