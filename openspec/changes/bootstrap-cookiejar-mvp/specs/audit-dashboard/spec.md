# Spec Delta

## Purpose

Help ordinary internet users concerned about privacy check a website and understand observed cookies without technical expertise or overstated safety claims.

## ADDED Requirements

### Requirement: URL submission
The landing view SHALL present CookieJar, a labeled website-address input, a "Check website" button, and a plain-language explanation that the tool visits without choosing consent. Keyboard submission SHALL work. Invalid input SHALL produce an associated readable validation message without an API call.

#### Scenario: Submit a website
- **WHEN** the user enters an absolute HTTP(S) URL and presses Enter or activates "Check website"
- **THEN** exactly one request is sent to the same-origin `/api/audit`

#### Scenario: Invalid input
- **WHEN** the user submits a blank or non-HTTP(S) address
- **THEN** the form identifies the validation error and retains the input for correction

### Requirement: Honest pending and error feedback
While a request is pending, the frontend SHALL prevent duplicate submissions and announce that the browser visit is in progress without fabricated percentages. Failures SHALL show a readable error and allow retry. A previous report SHALL NOT appear to belong to a newly submitted or failed URL.

#### Scenario: Audit pending
- **WHEN** an audit request has not completed
- **THEN** the submit control is disabled, an accessible status is announced, and no completed outcome is shown for that pending scan

#### Scenario: Check unavailable
- **WHEN** the API returns an error, cannot be reached, or exceeds the client timeout
- **THEN** the user receives an actionable message, the form becomes usable, and no successful report is fabricated

### Requirement: Understandable privacy context
The interface SHALL explain that it observes a separate fresh visit, not the user's own browser, accounts, history, extensions, or past consent. It SHALL warn against submitting private or token-bearing links, explain that other tracking may exist, and avoid assuming developer or site-owner knowledge.

#### Scenario: First-time privacy-conscious visitor
- **WHEN** a person reads the form and a completed finding
- **THEN** they can discover what the tool checks, that it does not inspect their personal browsing state, and why it cannot prove a website safe

### Requirement: Category explanations
The interface SHALL explain Essential, Analytics, Marketing, and Unclassified in everyday language. It SHALL distinguish an unidentified cookie from confirmed tracking and a signature-associated provider from proof of data transmission.

#### Scenario: Unidentified cookie
- **WHEN** a person encounters an Unclassified entry
- **THEN** the explanation says there is insufficient information to identify its purpose rather than declaring it safe or malicious

### Requirement: Consumer outcome headings
The primary result headings SHALL be "Tracking cookies detected" for FAIL, "Some cookies are unidentified" for REVIEW, and "No known tracking cookies observed" for PASS. Each SHALL explain the observation and uncertainty rather than lead with a compliance verdict or numerical privacy score.

#### Scenario: No matched tracking cookie
- **WHEN** the result is PASS
- **THEN** the main heading says "No known tracking cookies observed" and explicitly avoids claiming that no tracking exists

#### Scenario: Known tracker signature
- **WHEN** the result is FAIL
- **THEN** the main heading says "Tracking cookies detected" and identifies the matched Analytics or Marketing evidence

### Requirement: Summary and evidence dashboard
A completed result SHALL show its consumer outcome heading using text as well as color, category counts, total cookies, requested/final URLs, capture time, warnings, and observation limitations. It SHALL explain the rule and state that the finding is neither complete tracking detection nor legal certification.

#### Scenario: Review-required outcome
- **WHEN** a report contains unknown cookies but no known Analytics or Marketing cookies
- **THEN** the dashboard presents "Some cookies are unidentified" rather than a safety or compliance claim

#### Scenario: Tracking detected
- **WHEN** the outcome is FAIL
- **THEN** the dashboard identifies the Analytics and Marketing counts as the reason

### Requirement: Cookie breakdown
The dashboard SHALL make every reported cookie available with Name, Domain, Category, and Expiration. Provider and path SHALL remain discoverable, optionally in expanded details. Session cookies SHALL display "Session" with an explanation; persistent expirations SHALL show a readable timestamp and timezone.

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

### Requirement: Same-origin API integration
The frontend SHALL call relative `/api/audit` in development, previews, and production, without an external backend URL variable. It SHALL handle non-JSON platform errors and invalid report payloads as explicit failures rather than successful findings.

#### Scenario: Unexpected backend response
- **WHEN** the endpoint responds with HTML or malformed report JSON
- **THEN** the frontend shows a readable error instead of crashing or presenting "No known tracking cookies observed"
