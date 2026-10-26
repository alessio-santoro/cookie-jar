# Spec Delta

## Purpose

Observe cookies created during a clean first-page visit before consent interaction and report evidence-based findings with explicit limitations.

## ADDED Requirements

### Requirement: Isolated non-interactive observation
Each audit SHALL use fresh browser storage without shared cookies or cache, visit one target page, and perform no user interaction, including accepting or rejecting consent prompts.

#### Scenario: Repeated visits cannot share state
- **WHEN** two audits visit a site that sets a cookie on first load
- **THEN** each visit starts without cookies or other storage from the previous audit

#### Scenario: Consent banner remains untouched
- **WHEN** a page sets cookies only after a consent button is pressed
- **THEN** those cookies are not triggered by automated clicks, typing, or scrolling

### Requirement: Bounded observation
The worker SHALL wait for DOM content load with a 20-second navigation limit, attempt network idle for at most 3 seconds, and then observe for 2 seconds before capture. Network-idle timeout alone SHALL produce an explicit warning rather than an audit failure.

#### Scenario: Persistent page traffic
- **WHEN** a page loads its DOM but keeps making network requests
- **THEN** the audit captures cookies after the bounded idle attempt and observation period and includes a network-idle warning

#### Scenario: Delayed cookie within observation window
- **WHEN** a page creates a cookie during the post-load observation window
- **THEN** the cookie is present in the captured report

### Requirement: Complete browser-context cookie evidence
The report SHALL include every cookie present in the context at capture, identified by name, domain, and path. Each cookie SHALL expose name, domain, path, category, provider, matched signature, expiry, secure, HTTP-only, and same-site metadata, but SHALL NOT expose its value.

#### Scenario: Cookie identity and expiry
- **WHEN** two cookies have the same name on different paths or domains and one is a session cookie
- **THEN** both are reported separately and the session cookie has null expiry while persistent expiry is an ISO-8601 UTC timestamp

#### Scenario: Cross-origin cookies
- **WHEN** an embedded public resource successfully creates a cookie permitted by the browser
- **THEN** the context cookie appears even if its domain differs from the submitted page

### Requirement: Deterministic signature classification
The dictionary SHALL assign Essential, Analytics, Marketing, or Unclassified using explicit exact or anchored-prefix rules. It SHALL recognize `_ga`, `_ga_*`, and `_gid` as Google Analytics and `_fbp` as Meta Pixel Marketing. Unknown cookies SHALL remain Unclassified, and rules SHALL NOT infer necessity solely from first-party scope.

#### Scenario: Recognized and unknown cookies
- **WHEN** capture includes `_ga`, `_ga_ABC`, `_gid`, `_fbp`, and `custom_cookie`
- **THEN** the first three are Analytics, `_fbp` is Marketing, and `custom_cookie` is Unclassified

#### Scenario: Similar but unmatched cookie
- **WHEN** capture includes `prefix_ga` or `_gaFake`
- **THEN** neither matches the `_ga` or `_ga_` rules

### Requirement: Evidence-based outcome
The result SHALL be FAIL if any Analytics or Marketing cookies exist, otherwise REVIEW if any Unclassified cookies exist, otherwise PASS. Counts SHALL include all four categories and total cookies. The report SHALL describe these as signature-based findings, not legal certification.

#### Scenario: Known tracking takes precedence
- **WHEN** a report contains both Analytics and Unclassified cookies
- **THEN** its outcome is FAIL and all category counts remain visible

#### Scenario: Unknown-only cookies need review
- **WHEN** only Essential and Unclassified cookies are present
- **THEN** its outcome is REVIEW

#### Scenario: No known concerns observed
- **WHEN** no cookies or only dictionary-recognized Essential cookies are present
- **THEN** its outcome is PASS with the observation and classification limitations

### Requirement: Transparent capture scope
Successful reports SHALL identify requested URL, final URL, capture timestamp, duration, observation settings, and warnings. The stated scope SHALL exclude post-consent behavior, local-storage tracking, multi-page behavior, and cookies outside the observation window.

#### Scenario: Public redirect and observation limits
- **WHEN** a target redirects to another allowed public page and capture succeeds
- **THEN** the report distinguishes the submitted and final URLs and includes scope limitations
