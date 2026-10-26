# Spec Delta

## Purpose

Deploy the privacy-checking application as one Vercel project with reproducible development and verified browser execution, isolation, and operating limits.

## ADDED Requirements

### Requirement: Reproducible development setup
Documentation SHALL provide the supported Node version, dependency/browser installation, same-origin local startup, build, and test commands. A controlled cookie-setting fixture SHALL support deterministic end-to-end checks without relying on a third-party site's changing behavior. Java, Maven, and a separately running backend SHALL NOT be prerequisites.

#### Scenario: Local end-to-end verification
- **WHEN** a contributor follows the documented setup and checks the controlled fixture through the UI and same-origin API
- **THEN** the dashboard displays actual browser-captured cookies and the expected outcome
- **AND** any localhost fixture exception is explicit, test-only, and disabled in production

### Requirement: Single Vercel deployment
The UI and audit endpoint SHALL deploy together from one repository to one Vercel project and public origin. The selected architecture SHALL NOT require a second repository, separately hosted backend/proxy, external browser provider, or non-Vercel platform. It SHALL NOT require a frontend backend-host configuration variable.

#### Scenario: Preview and production routing
- **WHEN** the application is deployed to a Vercel preview or production URL
- **THEN** its UI and `/api/audit` work on that origin without a separately deployed backend or a static-page fallback intercepting API requests

### Requirement: Browser feasibility gate
Before full implementation, a protected deployment SHALL demonstrate real cookie capture, cold/warm execution, complete browser dependencies, isolated concurrent visits, deadline cleanup, and compliance with the selected Vercel plan's resource limits. A local-only browser test SHALL NOT count as deployment verification.

#### Scenario: Deployed cookie-setting target
- **WHEN** cold and warm invocations check a controlled allowed target on the intended Vercel setup
- **THEN** actual browser-captured cookies are returned within the configured execution, memory, package, and response limits

#### Scenario: Browser package cannot run
- **WHEN** the deployed browser cannot launch or satisfy resource, isolation, or cleanup requirements
- **THEN** the gate fails and implementation pauses for an explicit architecture decision without substituting an HTTP-only check

### Requirement: Network feasibility gate
The intended deployment SHALL demonstrate an enforced public-only browser egress boundary, including redirects, subresources, sockets, bypass attempts, and DNS rebinding, before public scanning. If the selected Vercel setup cannot meet it, work SHALL pause for an architecture decision without weakening the boundary or silently adding another service.

#### Scenario: Network controls are unavailable
- **WHEN** the chosen setup cannot prevent a validated hostname from reaching a non-public address after a DNS change
- **THEN** public scanning remains disabled, the gate fails, and documentation does not describe URL validation as sufficient

### Requirement: Documented deployment limits
Documentation SHALL state install/build/output settings, the selected Node runtime, function deadline, measured browser memory/cold-start behavior, concurrency semantics, ingress controls, spending safeguards, and rollback. It SHALL distinguish provider limits and charges from free or guaranteed capacity.

#### Scenario: Deployment setup review
- **WHEN** a contributor follows the Vercel setup
- **THEN** they can identify the verified plan/settings and operating costs without configuring Java, another host, wildcard CORS, or a public backend secret

### Requirement: Public release readiness
Public scanning SHALL remain disabled until browser/network gates, privacy handling, abuse controls, spending safeguards, and full-stack checks pass. Deployment health alone SHALL NOT be presented as proof that browser execution or private-network protection works.

#### Scenario: Preview works but safety verification is incomplete
- **WHEN** the page and function deploy but egress or isolation tests have not passed
- **THEN** the deployment is identified as a protected feasibility preview, not a publicly ready scanner
