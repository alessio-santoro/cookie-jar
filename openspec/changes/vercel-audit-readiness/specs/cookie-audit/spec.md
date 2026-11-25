# Spec Delta

## ADDED Requirements

### Requirement: Gate live checks on browser and network protections
The system SHALL perform a live audit only when Chromium's own sandbox and an isolated, public-only network boundary are available, and SHALL NOT disable either protection as a fallback.

#### Scenario: Required protections are available
- **WHEN** a valid public page is submitted and the browser sandbox and isolated network boundary start successfully
- **THEN** the system may perform the bounded audit within that protected environment

#### Scenario: A required protection cannot start
- **WHEN** a valid public page is submitted but either required protection is unavailable
- **THEN** the system returns a structured unavailable error without browsing the target or falling back to direct networking or an unsandboxed browser
