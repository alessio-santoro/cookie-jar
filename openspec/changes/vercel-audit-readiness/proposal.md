# Proposal

## Why

Website checks currently return an unavailable response when the runtime cannot start the required isolated network boundary or Chromium sandbox. Vercel is the selected deployment target, but its ability to satisfy those gates has not been verified; the app needs a protected, fixture-only deployment check before live scans can be enabled.

## What Changes

- Define that live audits run only when the required browser sandbox and public-only network boundary are available, and fail closed otherwise.
- Create a separate, public, static-only Vercel test fixture with deterministic dummy cookies and verify the packaged API and Chromium runtime in a protected Vercel preview using only that fixture.
- Confirm namespace support, proxy-enforced egress, Chromium sandbox operation without sandbox-disabling flags, and deployed function packaging and execution limits before enabling public scans.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cookie-audit`: Specify the browser and network protections required for live checks and the unavailable behavior when those protections cannot start.

## Impact

The change affects the Vercel deployment configuration, `/api/audit`, the isolated browser launcher and network boundary, and deployment-focused tests and documentation. The test fixture is a separate Vercel project, not a second scanner service. No production deployment or unrestricted scan is in scope until the protected-preview checks pass.
