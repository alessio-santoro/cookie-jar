# Spec Delta

## Purpose

Expose a same-origin, bounded website-check interface with predictable findings and errors while preventing visits to non-public destinations.

## ADDED Requirements

### Requirement: Audit request contract
`POST /api/audit` SHALL accept JSON with a required `url` string of at most 2048 characters. Only absolute HTTP(S) URLs with a host, no user information, and a default HTTP or HTTPS port SHALL be accepted. Surrounding whitespace SHALL be removed; fragments SHALL be excluded from navigation.

#### Scenario: Valid audit request
- **WHEN** a client posts `{"url":"https://example.com"}` and observation succeeds
- **THEN** the API responds with HTTP 200 and a structured audit report

#### Scenario: Invalid request
- **WHEN** a payload is malformed, lacks a nonblank URL, exceeds the URL limit, uses credentials, uses a non-default port, or uses a non-HTTP(S) scheme
- **THEN** the API returns HTTP 400 with a stable error code and readable message without starting a browser visit

### Requirement: Same-origin application API
The website and `/api/audit` SHALL be served from the same public origin in a single deployment. Browser clients SHALL use a relative API path without a separately configured backend host. The route SHALL accept POST JSON, reject unsupported methods, and reject disallowed browser origins without enabling wildcard CORS.

#### Scenario: Deployed website check
- **WHEN** a person submits a site on a preview or production deployment
- **THEN** the browser posts to that deployment's `/api/audit` without a cross-origin backend setting

#### Scenario: Disallowed browser origin
- **WHEN** a different origin attempts to submit a website check
- **THEN** the endpoint does not grant cross-origin access and rejects a disallowed Origin header

### Requirement: Public destination enforcement
The audit executor SHALL reject targets resolving to any non-public IPv4 or IPv6 address and prevent non-public connections through redirects, subresources, sockets, or DNS changes. Resolution failures SHALL fail closed. All browser traffic SHALL be covered by an enforced egress boundary before public scanning is enabled; initial URL checks alone SHALL NOT satisfy this requirement.

#### Scenario: Private or mixed-address target
- **WHEN** the initial host resolves to loopback, private, link-local, unspecified, reserved addresses, IPv4-mapped private IPv6, or a mix of public and non-public addresses
- **THEN** the API returns HTTP 400 with `UNSAFE_TARGET` and no connection reaches those destinations

#### Scenario: Public page redirects to private host
- **WHEN** an otherwise allowed page redirects to a non-public destination
- **THEN** the redirect is blocked and the API returns an `UNSAFE_TARGET` error rather than a successful report

#### Scenario: Unsafe subrequest
- **WHEN** a public page requests a non-public image, script, fetch, WebSocket, or popup destination
- **THEN** no connection reaches that destination and a successful main-page report explicitly records blocked subrequests

#### Scenario: DNS rebinding
- **WHEN** an allowed hostname changes from a public address to a non-public address after validation
- **THEN** the non-public connection is denied by the egress boundary

### Requirement: Stable successful report contract
Successful JSON SHALL contain `requestedUrl`, `finalUrl`, `capturedAt`, `durationMs`, `outcome`, `summary`, `observation`, `warnings`, and `cookies`. Category values SHALL be `ESSENTIAL`, `ANALYTICS`, `MARKETING`, or `UNCLASSIFIED`; outcome SHALL be `PASS`, `REVIEW`, or `FAIL`. Empty collections SHALL be arrays, not null.

#### Scenario: Zero-cookie report
- **WHEN** capture completes without cookies
- **THEN** `cookies` is empty, summary total and category counts are zero, and outcome is PASS

### Requirement: Explicit operational failures
Application-generated errors SHALL contain `code`, safe `message`, and `requestId`. Audit deadline/navigation timeout SHALL return 504; unreachable targets or main-document HTTP errors SHALL return 502; unexpected executor failures SHALL return 500. Errors SHALL NOT resemble successful findings or expose stack traces, cookie values, or internal network details. Platform-generated failures are handled separately by the client.

#### Scenario: Navigation timeout
- **WHEN** DOM content load exceeds the navigation deadline
- **THEN** the API returns HTTP 504 with `AUDIT_TIMEOUT` and no PASS outcome

#### Scenario: Target or worker failure
- **WHEN** navigation fails, the main document returns an HTTP error, or Chromium cannot launch
- **THEN** the API returns the corresponding structured error and correlated server-side diagnostics

### Requirement: Bounded audit execution
Each audit SHALL finish or terminate within a 35-second execution budget. A function instance SHALL admit at most one active browser without an unbounded queue and return HTTP 429 with `Retry-After` when occupied. Browser, process, context, and capacity resources SHALL be released on success, cancellation, and failure. Per-instance admission SHALL NOT be described as a global deployment limit.

#### Scenario: Concurrent submission
- **WHEN** another request reaches an instance with an active browser
- **THEN** it promptly receives HTTP 429 without launching a second browser on that instance

#### Scenario: Failed scan releases capacity
- **WHEN** an audit fails or exceeds its execution budget
- **THEN** its resources are cleaned up and a subsequent audit can run

#### Scenario: Requests reach separate instances
- **WHEN** the platform runs checks on multiple instances
- **THEN** their browser storage, reports, and process cleanup are independent and a local capacity counter is not claimed to limit the whole deployment

### Requirement: Public scan abuse controls
Before unrestricted public access, the deployment SHALL enforce ingress request-rate controls and configure provider spending/usage safeguards. Documentation SHALL state the selected plan's controls and limits. A client-side disabled button or per-instance memory counter SHALL NOT be presented as deployment-wide abuse protection or a guaranteed monetary cap.

#### Scenario: Excess public requests
- **WHEN** traffic exceeds the configured ingress scan-request limit
- **THEN** excess requests are denied before starting browser work

### Requirement: Privacy-preserving operation
The application SHALL NOT persist reports or log cookie values, request bodies, or URL query strings. Responses SHALL prevent caching. Diagnostics SHALL use request IDs and operational codes. Provider logging/retention limits SHALL be disclosed separately, and the browser SHALL NOT receive application credentials or the user's existing browsing state.

#### Scenario: Sensitive URL and cookie
- **WHEN** a submitted URL contains a query token and a captured cookie contains a secret value
- **THEN** neither secret appears in application logs and the cookie value is absent from the response

#### Scenario: Findings are not cached
- **WHEN** a report or application error is returned
- **THEN** it includes `Cache-Control: no-store` and is not saved to application report storage
