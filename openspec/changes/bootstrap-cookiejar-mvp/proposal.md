# Proposal

## Why

People concerned about online privacy need an understandable way to see whether a website creates known tracking cookies before they make a consent choice. CookieJar will explain the findings from a fresh automated visit without requiring technical knowledge or implying that an observation proves a website safe or legally compliant.

## What Changes

- Develop one plain-JavaScript React/Vite application with a Node.js audit API that contributors can run and verify locally without a Vercel account, project, or plan.
- Serve `POST /api/audit` on the same origin during local development and use a fresh headless Chromium visit with Playwright to capture cookies without consent interaction.
- Use a controlled local fixture for development until local browser isolation and public-only egress protections have been verified. Do not enable scans of arbitrary URLs before those protections pass.
- Defer Vercel deployment, plan limits, cold/warm measurements, ingress controls, and spending safeguards to a later deployment and release stage. Vercel remains a possible target, not a prerequisite for developing or validating the local application.
- Classify cookies as Essential, Analytics, Marketing, or Unclassified, explaining the categories and known providers in everyday language.
- Preserve FAIL/REVIEW/PASS internally, but lead with "Tracking cookies detected", "Some cookies are unidentified", or "No known tracking cookies observed", respectively.
- Present URL entry, honest loading/error feedback, a plain-language summary, and expandable technical evidence. Explain that results describe the tool's visit, not the user's personal browser or all tracking techniques.
- Bound execution and protect local scans from private-network access through targets, redirects, subrequests, sockets, or DNS changes. Apply deployment-wide abuse and spending controls before any later unrestricted public release.

## Capabilities

### New Capabilities

- `pre-consent-audit`: Fresh-browser observation, classification, evidence, and carefully scoped findings.
- `audit-api`: Same-origin validated requests, structured responses/errors, bounded execution, and abuse protection.
- `audit-dashboard`: Consumer-friendly URL submission, understandable findings, and accessible supporting evidence.
- `audit-deployment`: Reproducible local execution, browser/network readiness, and deployment verification when a target platform is selected.

### Modified Capabilities

None. The workspace contains OpenSpec configuration and generated workflow files, but no application or existing capability specifications.

## Impact

- Introduce one local-runnable npm project containing the React UI, a server-only JavaScript audit function, shared report validation/classification, and unit/component/browser tests.
- Use Node.js, Playwright, and a compatible Chromium distribution; validate the local browser path first and verify any later deployment separately.
- Remove the planned Java/Spring Boot worker, Maven/Lombok dependencies, separately hosted backend, Docker-worker deployment, configurable frontend backend URL, and production cross-origin setup.
- Local development requires no second repository, external browser provider, separately deployed proxy/worker, or Vercel project. Any additional service, host, or runtime needed for a future public release requires an explicit architecture decision.
- Developers and site owners remain secondary users. No accounts, report persistence, scheduled scans, multi-page crawling, browser extension, personal browsing-history inspection, consent interaction, post-consent comparisons, numeric privacy score, or legal certification is included.
