# Proposal

## Why

People concerned about online privacy need an understandable way to see whether a website creates known tracking cookies before they make a consent choice. CookieJar will explain the findings from a fresh automated visit without requiring technical knowledge or implying that an observation proves a website safe or legally compliant.

## What Changes

- Build one React/Vite application with Tailwind CSS, written in plain JavaScript, in one repository and one Vercel project.
- Serve a same-origin `POST /api/audit` through a Node.js Vercel Function that runs a fresh headless Chromium visit with Playwright and captures cookies without consent interaction.
- First verify browser packaging, cold starts, execution limits, isolation, and enforceable public-only egress on the intended Vercel setup. If the gate fails, stop for an architecture decision rather than silently changing hosts or weakening protection.
- Classify cookies as Essential, Analytics, Marketing, or Unclassified, explaining the categories and known providers in everyday language.
- Preserve FAIL/REVIEW/PASS internally, but lead with "Tracking cookies detected", "Some cookies are unidentified", or "No known tracking cookies observed", respectively.
- Present URL entry, honest loading/error feedback, a plain-language summary, and expandable technical evidence. Explain that results describe the tool's visit, not the user's personal browser or all tracking techniques.
- Bound execution and spending; protect scans from abuse and prevent private-network access through targets, redirects, subrequests, sockets, or DNS changes.

## Capabilities

### New Capabilities

- `pre-consent-audit`: Fresh-browser observation, classification, evidence, and carefully scoped findings.
- `audit-api`: Same-origin validated requests, structured responses/errors, bounded execution, and abuse protection.
- `audit-dashboard`: Consumer-friendly URL submission, understandable findings, and accessible supporting evidence.
- `audit-deployment`: One-project Vercel deployment, reproducible local execution, and verified browser/network readiness.

### Modified Capabilities

None. The workspace contains OpenSpec configuration and generated workflow files, but no application or existing capability specifications.

## Impact

- Introduce one npm project containing the React UI, a server-only JavaScript audit function, shared report validation/classification, and unit/component/browser tests.
- Use Node.js, Playwright, and a compatible serverless Chromium distribution; validate the deployed build before committing to the browser packaging approach.
- Remove the planned Java/Spring Boot worker, Maven/Lombok dependencies, separately hosted backend, Docker-worker deployment, configurable frontend backend URL, and production cross-origin setup.
- No second repository, external browser provider, separately deployed proxy/worker, or non-Vercel host is part of the selected architecture. Additional services or a different runtime require an explicit decision if feasibility tests demand them.
- Developers and site owners remain secondary users. No accounts, report persistence, scheduled scans, multi-page crawling, browser extension, personal browsing-history inspection, consent interaction, post-consent comparisons, numeric privacy score, or legal certification is included.
