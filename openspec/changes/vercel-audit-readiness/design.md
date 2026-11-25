# Design

## Context

See proposal.md for the motivation and the cookie-audit delta for required behavior. The API currently validates public URLs, creates a Linux user/network namespace boundary with a destination-checking proxy, then starts packaged Chromium with sandbox-disabling flags removed. Local tests confirm the network boundary but skip the real-browser check because this host blocks Chromium's nested sandbox namespace. Vercel has been selected, but no deployment has been configured or verified.

## Goals / Non-Goals

**Goals:**
- Establish whether a Vercel Node.js Function can run the existing isolation and browser requirements without relaxing them.
- Keep any feasibility deployment protected and restricted to a single controlled fixture.
- Enable public live checks only after the deployed runtime passes all security and operational gates.

**Non-Goals:**
- Add an unsandboxed Chromium fallback, bypass the proxy, or permit direct browser egress.
- Scan arbitrary public destinations from a feasibility preview.
- Introduce a separate scanner service or change hosting platforms in this change.
- Claim Vercel readiness based only on local tests or build success.

## Decisions

1. **Use a protected Vercel preview as the first runtime proof.** Local tests cannot establish the Function's kernel, executable availability, package layout, or limits. A protected preview exercises the actual deployed runtime; a local-only workaround would not resolve the selected deployment target.
2. **Constrain feasibility traffic to a separate public test fixture.** Create an owner-controlled, static-only Vercel fixture project with deterministic dummy cookies and no scanner API or secrets. Its public URL allows the protected preview's browser to visit without a Vercel protection-bypass credential. Preview configuration must restrict audit requests to that exact URL, in addition to requiring Vercel preview protection and the existing same-origin/API checks. Attempts to submit any other destination must be rejected before browser startup. Cookie values must not appear in reports or diagnostics.
3. **Keep the existing security boundary unchanged.** The preview must prove namespace creation, loopback-only browser networking, forced proxy use, public-address validation and pinning, and Chromium's native sandbox with no `--no-sandbox` or equivalent disabling flags. A failed gate leaves checks unavailable; it does not trigger a fallback.
4. **Treat deployed resource limits as release gates.** Measure the actual function bundle and dependency inclusion, cold and warm startup, memory, response size, and execution duration against the selected Vercel plan. The current bounded API operation must fit with room for cleanup and an error response.
5. **Promote only after all preview gates pass.** Production configuration may enable public destinations only after the deployed boundary and browser tests pass. If Vercel cannot satisfy a gate, stop with the API fail-closed and report the blocker; a different architecture requires a separate decision.

## Risks / Trade-offs

- [Vercel may prohibit nested namespaces or omit required system utilities] -> Test the actual Function before tuning packaging; preserve the unavailable response if the kernel or tools do not support the boundary.
- [A protected preview could still be abused to contact arbitrary public hosts] -> Enforce an exact fixture allowlist in preview configuration and test rejection of non-fixture URLs.
- [The browser binary or execution time may exceed plan limits] -> Measure the deployed artifact and representative cold/warm fixture runs; do not infer limits from package-directory sizes or local timings.
- [A passing fixture visit may not prove every destination-policy edge case] -> Retain the existing unit and boundary tests, and require deployed checks for redirects, subresources, DNS pinning, and forbidden private destinations before production promotion.

## Migration Plan

1. Create the separate public fixture and configure the scanner to reject all other destinations before deploying its protected preview.
2. Deploy the API and packaged browser, then run the isolation, sandbox, fixture, and resource-limit checks.
3. If all checks pass, promote the deployment with the normal public destination policy enabled and verify the production API. If any check fails, keep scans unavailable and remove or disable the preview API; do not weaken the boundary.

## Open Questions

None. The selected scope is Vercel-only; inability to meet the gates is a deployment blocker, not permission to change the security model.
