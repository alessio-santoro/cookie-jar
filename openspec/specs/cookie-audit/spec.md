# cookie-audit Specification

## Purpose

Lets users inspect cookie metadata observed during one isolated, pre-consent visit to a page they submit, with clear distinctions between observed facts and heuristic interpretation.

## Requirements

### Requirement: Audit one submitted page in a fresh pre-consent visit
The system SHALL inspect only the submitted public page URL in a fresh browser context, without using the user's browser state or interacting with consent controls.

#### Scenario: Submit a public page
- **WHEN** a user submits a valid public HTTP or HTTPS page URL
- **THEN** the system visits that page in a fresh context and observes cookies during a bounded visit before any consent choice

#### Scenario: Reject an unsafe destination
- **WHEN** a submitted URL is invalid or resolves to a non-public destination
- **THEN** the system rejects the request before browsing that destination

### Requirement: Report observed cookie metadata without values
The system SHALL report cookie names, scope and settings observed in the audit context, but SHALL NOT include cookie values.

#### Scenario: Display observed cookie evidence
- **WHEN** cookies are present in the browser context at capture time
- **THEN** the report shows each cookie's name, domain, path, expiration, Secure, HTTP-only, and SameSite attributes without its value

#### Scenario: No cookies are observed
- **WHEN** no cookies are present at capture time
- **THEN** the report says none were observed during this visit and does not imply the page has no other tracking

### Requirement: Distinguish cookie evidence from heuristic interpretation
The system SHALL identify category and provider matches as heuristic associations, leave unmatched cookies unclassified, and SHALL NOT claim to have established cookie purpose or actual reads or transmission.

#### Scenario: A cookie matches a known signature
- **WHEN** a cookie name matches a configured signature
- **THEN** the report identifies the associated category or provider and explains that the match is not proof of purpose or data transmission

#### Scenario: A cookie has no known signature
- **WHEN** a cookie name matches no configured signature
- **THEN** the report marks it unclassified rather than inferring that it is essential, safe, or non-tracking

### Requirement: Explain the scope and limits of an audit
The system SHALL explain that each report covers one fresh, pre-consent visit to the submitted page and does not certify site safety or legal compliance.

#### Scenario: User reviews an audit result
- **WHEN** an audit report is displayed
- **THEN** the report makes clear that other pages, later behavior, post-consent activity, local storage, fingerprinting, and cookieless tracking are not covered

### Requirement: Keep the audit read-only and reports ephemeral
The system SHALL NOT modify the user's browser or persist audit reports, and SHALL prevent cached audit responses from being reused as later findings.

#### Scenario: Audit completes
- **WHEN** an audit report is returned
- **THEN** it is returned as a non-cached response and is not retained as user history
