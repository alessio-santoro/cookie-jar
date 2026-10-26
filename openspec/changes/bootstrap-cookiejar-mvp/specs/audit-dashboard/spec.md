# Spec Delta

## Purpose

Help developers and site owners submit a website and understand observed pre-consent cookie findings without overstating compliance.

## ADDED Requirements

### Requirement: URL submission
The landing view SHALL present the CookieJar name, a labeled website URL input, an "Audit Site" submit button, and a concise explanation that no consent interaction occurs. Keyboard submission SHALL work. Invalid input SHALL produce an associated readable validation message without an API call.

#### Scenario: Submit a website
- **WHEN** the user enters an absolute HTTP(S) URL and presses Enter or activates "Audit Site"
- **THEN** exactly one audit request is sent to the configured backend

#### Scenario: Invalid input
- **WHEN** the user submits a blank or non-HTTP(S) address
- **THEN** the form identifies the validation error and retains the input for correction

### Requirement: Honest pending and error feedback
While a request is pending, the frontend SHALL prevent duplicate submissions and announce that the browser visit is in progress without fabricated percentages. Failures SHALL show a readable error and allow retry. A previous report SHALL NOT appear to belong to a newly submitted or failed URL.

#### Scenario: Audit pending
- **WHEN** an audit request has not completed
- **THEN** the submit control is disabled, an accessible status is announced, and no completed outcome is shown for that pending scan

#### Scenario: Worker unavailable
- **WHEN** the backend returns an error, cannot be reached, or exceeds the client timeout
- **THEN** the user receives an actionable message, the form becomes usable, and no successful report is fabricated

### Requirement: Summary and evidence dashboard
A completed result SHALL show PASS, REVIEW, or FAIL using text as well as color, category counts, total cookies, requested/final URLs, capture time, warnings, and observation limitations. It SHALL explain the outcome rule and state that a single-page signature-based audit is not legal certification.

#### Scenario: Review-required outcome
- **WHEN** a report contains unknown cookies but no known Analytics or Marketing cookies
- **THEN** the dashboard presents REVIEW rather than PASS or a guaranteed-compliance claim

#### Scenario: Tracking detected
- **WHEN** the outcome is FAIL
- **THEN** the dashboard identifies the Analytics and Marketing counts as the reason

### Requirement: Cookie breakdown
The dashboard SHALL display every reported cookie with at least Name, Domain, Category, and Expiration. Provider and path SHALL remain discoverable. Session cookies SHALL display "Session"; persistent expirations SHALL display a readable timestamp with timezone information.

#### Scenario: Empty capture
- **WHEN** a report contains no cookies
- **THEN** the dashboard shows an explicit zero-cookie state and observation limitations rather than an empty unexplained table

#### Scenario: Long names on small screens
- **WHEN** the report includes long cookie names/domains and the viewport is 375 pixels wide
- **THEN** evidence remains accessible without viewport-level horizontal overflow; a labeled table scroll region is acceptable

### Requirement: Accessible responsive interaction
The frontend SHALL provide semantic form and table markup, visible focus, associated errors, announced status changes, and reduced-motion support. It SHALL remain usable at 200% zoom and on desktop and mobile without relying solely on color to communicate findings.

#### Scenario: Keyboard and assistive technology
- **WHEN** a user audits a site using keyboard navigation and a screen reader
- **THEN** labels, focus, pending status, errors, outcome, and table headers are available in a logical order

### Requirement: Configurable backend integration
The frontend SHALL obtain the backend base URL from build-time configuration, document a local-development default, and handle non-JSON errors and invalid report payloads as explicit failures.

#### Scenario: Unexpected backend response
- **WHEN** the configured endpoint responds with HTML or malformed report JSON
- **THEN** the frontend shows an integration error instead of crashing or presenting a PASS
