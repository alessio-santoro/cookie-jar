# Proposal

## Why

People concerned about online privacy need an understandable way to see whether a website creates known tracking cookies before they make a consent choice. CookieJar will explain the findings from a fresh automated visit without requiring technical knowledge or implying that an observation proves a website safe or legally compliant.

## What Changes

- Build one React/Vite application with Tailwind CSS, written in plain JavaScript, in one repository, **running locally first**. Deployment to Vercel is deferred to a later stage and a separate change.
- Serve a same-origin `POST /api/audit` (Vercel-function-shaped Node.js handler, mounted locally by the Vite dev/preview server) that runs a fresh headless Chromium visit with Playwright and captures cookies without consent interaction.
- First verify, locally, browser operation, isolation, deadline cleanup, and enforceable public-only egress. If the gate fails, stop for an architecture decision rather than weakening protection.
- Keep the code Vercel-compatible so the later deployment stage (serverless Chromium, platform egress, rate/spend controls) is configuration work, without claiming any of it is verified now.
- Classify cookies as Essential, Analytics, Marketing, or Unclassified, explaining the categories and known providers in everyday language.
- Preserve FAIL/REVIEW/PASS internally, but lead with "Tracking cookies detected", "Some cookies are unidentified", or "No known tracking cookies observed", respectively.
- Present URL entry, honest loading/error feedback, a plain-language summary, and expandable technical evidence. Explain that results describe the tool's visit, not the user's personal browser or all tracking techniques.
- Bound execution; prevent private-network access through targets, redirects, subrequests, sockets, or DNS changes. Deployment-wide abuse and spending controls belong to the deployment stage.

## Capabilities

### New Capabilities

- `pre-consent-audit`: Fresh-browser observation, classification, evidence, and carefully scoped findings.
- `audit-api`: Same-origin validated requests, structured responses/errors, and bounded execution (deployment abuse controls deferred).
- `audit-dashboard`: Consumer-friendly URL submission, understandable findings, and accessible supporting evidence.
- `audit-deployment`: Reproducible local execution and verified local browser/network readiness; Vercel deployment requirements are deferred to a later change.

### Modified Capabilities

None. The workspace contains OpenSpec configuration and generated workflow files, but no application or existing capability specifications.

## Impact

- Introduce one npm project containing the React UI, a server-only JavaScript audit function, shared report validation/classification, and unit/component/browser tests.
- Use Node.js and Playwright with a locally installed Chromium. The serverless Chromium distribution and Vercel packaging are validated in the later deployment stage.
- Remove the planned Java/Spring Boot worker, Maven/Lombok dependencies, separately hosted backend, Docker-worker deployment, configurable frontend backend URL, and production cross-origin setup.
- No second repository, external browser provider, or separately deployed proxy/worker is part of the selected architecture. Existing Vercel artifacts (`vercel.json`, preview-check script) stay in place but are out of scope for local acceptance. The app must not be exposed publicly until the deployment stage passes its gates.
- Developers and site owners remain secondary users. No accounts, report persistence, scheduled scans, multi-page crawling, browser extension, personal browsing-history inspection, consent interaction, post-consent comparisons, numeric privacy score, or legal certification is included.
