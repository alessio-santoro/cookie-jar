# Proposal

## Why

People without technical expertise have little clear evidence about cookies a page may set before they choose a consent option. CookieJar already has a URL form and an isolated browser audit, but its product promise needs to stay precise: it observes cookie presence and settings in one fresh visit, not what a site actually reads or transmits.

## What Changes

- Define CookieJar as an audit-only, exact-page, pre-consent cookie snapshot.
- Present observed cookie attributes separately from heuristic category and provider associations, and explain unclassified results and observation limits in plain language.
- Keep the audit read-only and privacy-bounded: do not use the visitor's browser, retain reports, expose cookie values, or imply safety or legal compliance.
- Keep active cookie blocking/removal, whole-domain crawling, post-consent comparison, and actual cookie-read/transmission analysis out of scope.

## Capabilities

### New Capabilities
- `cookie-audit`: Submit one public page URL and receive a bounded, evidence-based report of cookies observed during a fresh pre-consent visit.

### Modified Capabilities
- None.

## Impact

The existing React form and result components, `/api/audit` handler, isolated browser audit, shared report contract and classifier, tests, and README may need alignment with the product definition. The existing public-destination and browser-isolation gates remain mandatory; no deployment provider is selected or assumed by this change.
