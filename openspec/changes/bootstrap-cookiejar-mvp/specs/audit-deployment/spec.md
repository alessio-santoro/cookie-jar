# Spec Delta

## Purpose

Make the split frontend and browser-worker application reproducible locally and deployable with explicit operational and network boundaries.

## ADDED Requirements

### Requirement: Reproducible development setup
Documentation SHALL provide Java 17+, Maven, Node, frontend dependency installation, browser installation, configuration, startup, and validation commands. A controlled cookie-setting fixture SHALL permit deterministic end-to-end verification without depending on a third-party website.

#### Scenario: Local end-to-end verification
- **WHEN** a developer follows the documented setup and scans the controlled fixture through the frontend and backend
- **THEN** the dashboard displays actual browser-captured cookies and the expected outcome
- **AND** any localhost fixture exception is explicit, test-only, and disabled in production

### Requirement: Browser-ready backend container
The backend image SHALL package the application, matching Chromium binaries, and required system libraries. It SHALL support a configurable listening port and run as a non-root user. Documentation SHALL state browser sandbox and host-resource requirements rather than silently disabling sandbox protection.

#### Scenario: Container smoke test
- **WHEN** the image is built and run in a supported container environment
- **THEN** health checks succeed and an audit of a controlled allowed target launches Chromium and returns real cookies

### Requirement: Explicit cross-origin policy
The backend SHALL allow only configured exact frontend origins for audit requests and preflights, with a documented localhost development origin. It SHALL NOT enable wildcard origins or credentials by default.

#### Scenario: Allowed and disallowed origins
- **WHEN** an allowed frontend sends a JSON POST preflight and an unrelated origin sends the same preflight
- **THEN** only the allowed origin receives permission to call the audit endpoint

### Requirement: Vercel frontend deployment
The project SHALL document the frontend root directory, install/build commands, output directory, and backend URL variable needed for Vercel. The production frontend SHALL use HTTPS to call an HTTPS backend and SHALL NOT require exposing secrets in browser configuration.

#### Scenario: Production frontend build
- **WHEN** the frontend is built with its production backend URL and published on Vercel
- **THEN** the deployed form sends requests to that URL rather than localhost

### Requirement: Public hosting readiness
Deployment guidance SHALL distinguish local MVP readiness from safe public exposure. Internet-facing deployment SHALL require enforced public-only egress, protection of metadata/internal networks, inbound rate limits, suitable browser isolation, and proxy timeouts longer than the bounded audit budget.

#### Scenario: Hosting without isolated egress
- **WHEN** a candidate host cannot enforce the public-only browser network boundary
- **THEN** documentation identifies it as unsuitable for unrestricted public scanning and does not describe application URL validation alone as sufficient

### Requirement: Worker health
A health endpoint SHALL expose lightweight process readiness without running an audit or disclosing configuration and SHALL become unhealthy or unready if the worker cannot accept audits because its execution subsystem has failed.

#### Scenario: Health probe during normal work
- **WHEN** a hosting platform probes a healthy worker during an audit
- **THEN** the probe responds promptly without launching another browser or consuming audit capacity
