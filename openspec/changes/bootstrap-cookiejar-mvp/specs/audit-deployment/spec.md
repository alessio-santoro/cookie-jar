# Spec Delta

## Purpose

Support reproducible local development of the privacy-checking application, with browser and network safety verified before live scans and deployment-specific checks deferred until a platform is selected.

## ADDED Requirements

### Requirement: Reproducible development setup
The application SHALL be runnable and testable locally without a Vercel account, project, plan, or CLI. Documentation SHALL provide the supported Node version, dependency/browser installation, same-origin local startup, build, and test commands. A controlled cookie-setting fixture SHALL support deterministic end-to-end checks without relying on a third-party site's changing behavior. Java, Maven, and a separately running backend SHALL NOT be prerequisites.

#### Scenario: Local end-to-end verification
- **WHEN** a contributor follows the documented setup and checks the controlled fixture through the UI and same-origin API
- **THEN** the dashboard displays actual browser-captured cookies and the expected outcome
- **AND** any localhost fixture exception is explicit, test-only, and disabled in production

#### Scenario: Local development without deployment access
- **WHEN** a contributor has no Vercel credentials, project, or selected plan
- **THEN** they can still run, test, and develop the application locally

### Requirement: Single Vercel deployment
If Vercel is selected as a deployment target, the UI and audit endpoint SHALL deploy together from one repository to one Vercel project and public origin. This deployment requirement SHALL NOT block local development. The selected Vercel architecture SHALL NOT require a second repository, separately hosted backend/proxy, external browser provider, or frontend backend-host configuration variable.

#### Scenario: Preview and production routing
- **WHEN** the application is deployed to a Vercel preview or production URL
- **THEN** its UI and `/api/audit` work on that origin without a separately deployed backend or a static-page fallback intercepting API requests

### Requirement: Browser feasibility gate
Before live arbitrary-URL scanning is enabled locally, local verification SHALL demonstrate real fixture cookie capture, browser isolation, deadline cleanup, and an enforceable public-only egress boundary. Before a Vercel deployment is released, a protected deployment SHALL separately demonstrate cold/warm execution, complete browser dependencies, resource limits, and operating constraints for the selected plan. Local results SHALL NOT count as Vercel deployment verification.

#### Scenario: Local controlled cookie-setting target
- **WHEN** the local browser checks the owned controlled fixture
- **THEN** actual browser-captured cookies are returned from a fresh context within the local execution budget

#### Scenario: Browser package cannot run
- **WHEN** the local browser cannot launch or satisfy isolation, deadline, or cleanup requirements
- **THEN** live scanning remains disabled while fixture-backed development may continue, and no HTTP-only check is substituted

#### Scenario: Vercel deployment verification
- **WHEN** a protected Vercel preview is tested on the selected plan
- **THEN** cold and warm invocations satisfy the measured package, memory, response, and duration limits before public release

### Requirement: Network feasibility gate
Every runtime that enables live scans SHALL demonstrate an enforced public-only browser egress boundary, including redirects, subresources, sockets, bypass attempts, and DNS rebinding. Local scanning SHALL remain disabled until local enforcement passes. Vercel deployment verification SHALL occur before public release if Vercel is selected.

#### Scenario: Network controls are unavailable
- **WHEN** the local runtime or selected deployment cannot prevent a validated hostname from reaching a non-public address after a DNS change
- **THEN** live scanning remains disabled in that runtime, and documentation does not describe URL validation as sufficient

### Requirement: Documented deployment limits
When a deployment target is selected, documentation SHALL state install/build/output settings, the selected Node runtime, execution limits, measured browser memory/cold-start behavior, concurrency semantics, ingress controls, spending safeguards, and rollback. It SHALL distinguish provider limits and charges from free or guaranteed capacity. These deployment details SHALL NOT be prerequisites for local development.

#### Scenario: Deployment setup review
- **WHEN** a contributor follows the Vercel setup
- **THEN** they can identify the verified plan/settings and operating costs without configuring Java, another host, wildcard CORS, or a public backend secret

### Requirement: Public release readiness
Public scanning SHALL remain disabled until browser/network gates, privacy handling, abuse controls, spending safeguards, and full-stack checks pass. Deployment health alone SHALL NOT be presented as proof that browser execution or private-network protection works.

#### Scenario: Preview works but safety verification is incomplete
- **WHEN** the page and function deploy but egress or isolation tests have not passed
- **THEN** the deployment is identified as a protected feasibility preview, not a publicly ready scanner
