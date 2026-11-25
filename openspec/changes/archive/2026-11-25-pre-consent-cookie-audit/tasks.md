# Tasks

## 1. Evidence-centered results

- [x] 1.1 Replace verdict-like result headings and summaries with plain-language descriptions of observed matches, unclassified cookies, or no configured signatures; verify all three outcomes in the result component tests.
- [x] 1.2 Make cookie category and provider copy consistently describe heuristic associations rather than proven purpose; verify the evidence component explains unmatched cookies without calling them essential or safe.

## 2. Product scope and documentation

- [x] 2.1 Align the form and result explanations with the exact-page, fresh, pre-consent visit and its exclusions; verify the form and result component tests cover the user-facing scope.
- [x] 2.2 Update README product and limitations text to match the audit-only contract, preserve the fail-closed browser/network readiness caveat, and remove references to planning files that are no longer present; verify documented commands and links against the repository.

## 3. Integration verification

- [x] 3.1 Run `npm run lint`, `npm test`, `npm run test:components`, `npm run test:browser`, and `npm run build`; confirm the cookie-audit scenarios remain covered and record any browser-sandbox limitation without weakening the isolation requirements.
