# Spec Delta

## Purpose

Expose a synchronous, bounded audit interface with predictable reports and errors while preventing visits to non-public destinations.

## ADDED Requirements

### Requirement: Audit request contract
`POST /api/audit` SHALL accept JSON with a required `url` string of at most 2048 characters. Only absolute HTTP(S) URLs with a host, no user information, and a default HTTP or HTTPS port SHALL be accepted. Surrounding whitespace SHALL be removed; fragments SHALL be excluded from navigation.

#### Scenario: Valid audit request
- **WHEN** a client posts `{"url":"https://example.com"}` and observation succeeds
- **THEN** the API responds with HTTP 200 and a structured audit report

#### Scenario: Invalid request
- **WHEN** a payload is malformed, lacks a nonblank URL, exceeds the URL limit, uses credentials, uses a non-default port, or uses a non-HTTP(S) scheme
- **THEN** the API returns HTTP 400 with a stable error code and readable message without starting a browser visit

### Requirement: Public destination enforcement
The worker SHALL reject targets resolving to any non-public IPv4 or IPv6 address and prevent connections to non-public destinations through redirects, subresources, sockets, and DNS changes. Failed DNS resolution SHALL fail closed. Browser traffic SHALL be subject to network-level egress enforcement before public deployment.

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
Errors SHALL contain a stable `code`, safe `message`, and `requestId`. Navigation timeouts SHALL return 504; unreachable targets or main-document HTTP errors SHALL return 502; unexpected worker failures SHALL return 500. Errors SHALL NOT resemble successful audit reports or expose stack traces, cookie values, or internal network details.

#### Scenario: Navigation timeout
- **WHEN** DOM content load exceeds the navigation deadline
- **THEN** the API returns HTTP 504 with `AUDIT_TIMEOUT` and no PASS outcome

#### Scenario: Target or worker failure
- **WHEN** navigation fails, the main document returns an HTTP error, or Chromium cannot launch
- **THEN** the API returns the corresponding structured error and correlated server-side diagnostics

### Requirement: Bounded worker capacity
The default worker SHALL admit one concurrent audit without an unbounded queue, return HTTP 429 with `Retry-After` when occupied, and terminate audit work within a 35-second execution budget. Browser, context, and capacity resources SHALL be released on success and failure.

#### Scenario: Concurrent submission
- **WHEN** another request arrives while the worker is occupied
- **THEN** it promptly receives HTTP 429 and does not launch a second browser

#### Scenario: Failed scan releases capacity
- **WHEN** an audit fails or exceeds its execution budget
- **THEN** its resources are cleaned up and a subsequent audit can run

### Requirement: Privacy-preserving operation
The application SHALL NOT persist audit reports or log cookie values, request bodies, or URL query strings. Server logs SHALL use request identifiers and operational failure codes for correlation.

#### Scenario: Sensitive URL and cookie
- **WHEN** a submitted URL contains a query token and a captured cookie contains a secret value
- **THEN** neither secret appears in application logs and the cookie value is absent from the response
