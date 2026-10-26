# Proposal

## Why

Developers and site owners need a repeatable way to discover cookies created before a visitor interacts with a consent banner. CookieJar will provide an evidence-oriented first-page audit without implying that a short browser observation proves legal compliance.

## What Changes

- Create a Java 17 / Spring Boot REST worker using Playwright Chromium to observe a clean, non-interactive visit and capture browser-context cookies.
- Classify cookie signatures as Essential, Analytics, Marketing, or Unclassified, including provider and match evidence.
- Return FAIL for known Analytics or Marketing cookies, REVIEW for otherwise unclassified cookies, and PASS when neither exists.
- Build a React/Vite/TypeScript frontend with Tailwind CSS: URL entry, loading/error states, summary, and cookie details.
- Restrict scans to public HTTP(S) destinations, including redirects and subrequests; bound browser work and document deployment-level egress isolation.
- Prepare configurable CORS, a backend Docker image, Vercel frontend configuration, and reproducible local end-to-end verification.

## Capabilities

### New Capabilities

- `pre-consent-audit`: Clean-browser observation, classification, evidence, and report outcome.
- `audit-api`: Validated synchronous audit requests, structured responses/errors, and bounded execution.
- `audit-dashboard`: Accessible URL submission, scan feedback, and responsive report presentation.
- `audit-deployment`: Reproducible local/container execution, frontend deployment, cross-origin configuration, and safe public-hosting prerequisites.

### Modified Capabilities

None. The workspace contains OpenSpec configuration and generated workflow files, but no application or existing capability specifications.

## Impact

- Introduce `backend/` (Maven, Spring Web, validation, Lombok, Playwright Java, JUnit) and `frontend/` (React, Vite, TypeScript, Tailwind, component/API tests).
- Introduce `POST /api/audit`, health reporting, configuration examples, container build files, and operational documentation.
- Browser visits execute untrusted public websites: isolated egress and abuse controls are necessary before internet exposure.
- No accounts, persistence, scheduled scans, multi-page crawling, consent-banner interaction, post-consent comparisons, or legal certification in this MVP.
