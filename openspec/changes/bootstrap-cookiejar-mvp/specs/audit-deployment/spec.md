# Spec Delta

## Purpose

Run the privacy-checking application locally with reproducible development and verified browser execution, isolation, and network enforcement. Vercel deployment is deferred to a later change.

## ADDED Requirements

### Requirement: Reproducible development setup
Documentation SHALL provide the supported Node version, dependency/browser installation, same-origin local startup (Vite dev/preview serving `/api/audit`), build, and test commands. A controlled cookie-setting fixture SHALL support deterministic end-to-end checks without relying on a third-party site's changing behavior. Java, Maven, and a separately running backend SHALL NOT be prerequisites.

#### Scenario: Local end-to-end verification
- **WHEN** a contributor follows the documented setup and checks the controlled fixture through the UI and same-origin API
- **THEN** the dashboard displays actual browser-captured cookies and the expected outcome
- **AND** any localhost fixture exception is explicit, test-only, and disabled in production

### Requirement: Local-first operation
The UI and audit endpoint SHALL run together from one repository on one local origin without a second repository, separately hosted backend/proxy, external browser provider, frontend backend-host variable, or Vercel account. The code SHALL remain compatible with a later single-project Vercel deployment, and existing Vercel configuration SHALL NOT be broken.

#### Scenario: Local routing
- **WHEN** the application is started with the documented dev or build-plus-preview command
- **THEN** the UI and `/api/audit` work on that origin and no static-page fallback intercepts API requests

### Requirement: Local browser feasibility gate
Before full implementation, a local run SHALL demonstrate real cookie capture, isolated concurrent visits, and deadline/process-tree cleanup using a controlled fixture.

#### Scenario: Browser cannot run or clean up
- **WHEN** the local browser cannot launch or satisfy isolation or cleanup requirements
- **THEN** the gate fails and implementation pauses for an explicit architecture decision without substituting an HTTP-only check

### Requirement: Local network feasibility gate
The application SHALL demonstrate an enforced public-only browser egress boundary, including redirects, subresources, sockets, bypass attempts, and DNS rebinding, using protected local listeners.

#### Scenario: Validated hostname changes to a private address
- **WHEN** DNS for a previously validated hostname changes to a non-public address
- **THEN** the browser connection is denied, and documentation does not describe URL validation alone as sufficient

### Requirement: Deferred Vercel deployment
Documentation SHALL list what remains unverified for Vercel (serverless Chromium packaging, function limits, cold starts, platform egress enforcement, ingress rate limits, spending controls, provider logging, rollback). Public scanning SHALL remain disabled until a later deployment change passes those gates, and local results SHALL NOT be presented as deployment verification.

#### Scenario: Local acceptance passes
- **WHEN** all local checks pass
- **THEN** the application is described as locally verified only, not as publicly ready or verified on Vercel
