import { performance } from 'node:perf_hooks'

const preview = process.env.COOKIEJAR_PREVIEW_URL
const token = process.env.COOKIEJAR_SPIKE_TOKEN
const protectionBypass = process.env.COOKIEJAR_VERCEL_PROTECTION_BYPASS

if (!preview || !token) {
  console.error('Set COOKIEJAR_PREVIEW_URL and COOKIEJAR_SPIKE_TOKEN before running.')
  process.exitCode = 1
} else {
  let previewUrl
  try {
    previewUrl = new URL(preview)
  } catch {
    console.error('COOKIEJAR_PREVIEW_URL must be a valid protected preview URL.')
    process.exitCode = 1
  }

  if (previewUrl && (
    previewUrl.protocol !== 'https:'
    || previewUrl.username
    || previewUrl.password
    || previewUrl.search
    || previewUrl.hash
    || previewUrl.hostname === 'cookiesjar.vercel.app'
  )) {
    console.error('Use the HTTPS URL of a protected preview deployment, not production.')
    process.exitCode = 1
  } else if (previewUrl) {
    const measurements = []
    for (const sequence of [1, 2]) {
      const started = performance.now()
      let response
      try {
        response = await fetch(new URL('/api/audit', previewUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(protectionBypass
              ? { 'x-vercel-protection-bypass': protectionBypass }
              : {}),
          },
          body: '{}',
          cache: 'no-store',
          signal: AbortSignal.timeout(70000),
        })
      } catch {
        console.error(JSON.stringify({
          sequence,
          code: 'PREVIEW_UNREACHABLE',
          message: 'The protected preview request failed before a response arrived.',
        }))
        process.exitCode = 1
        break
      }

      const text = await response.text()
      const clientElapsedMs = Math.round(performance.now() - started)
      let report
      try {
        report = JSON.parse(text)
      } catch {
        console.error(JSON.stringify({
          sequence,
          status: response.status,
          clientElapsedMs,
          code: 'NON_JSON_RESPONSE',
          message: 'The preview returned a non-JSON response; check deployment protection and function logs.',
        }))
        process.exitCode = 1
        break
      }

      if (!response.ok || report.scope !== 'local-controlled-fixture-only') {
        console.error(JSON.stringify({
          sequence,
          status: response.status,
          code: report.code ?? 'UNEXPECTED_RESPONSE',
          message: report.message ?? 'The endpoint did not return the controlled fixture report.',
          requestId: report.requestId,
        }))
        process.exitCode = 1
        break
      }

      measurements.push({
        sequence,
        status: response.status,
        requestId: report.requestId,
        functionInstanceId: report.functionInstanceId,
        instanceInvocation: report.instanceInvocation,
        functionUptimeMs: report.functionUptimeMs,
        clientElapsedMs,
        responseBytes: Buffer.byteLength(text),
        browserVersion: report.browserVersion,
        durationMs: report.durationMs,
        executableReadyMs: report.executableReadyMs,
        browserStartupMs: report.browserStartupMs,
        browserParentRssBytes: report.browserParentRssBytes,
        nodeRssBytes: report.nodeRssBytes,
        browserSandboxDisabled: report.browserSandboxDisabled,
        cookies: report.cookies?.map(({ name, httpOnly, secure, sameSite, expiresAt }) => ({
          name, httpOnly, secure, sameSite, expiresAt,
        })),
      })
    }

    if (measurements.length === 2) {
      const [first, second] = measurements
      console.log(JSON.stringify({
        deploymentHost: previewUrl.host,
        measurements,
        reusedFunctionInstance: first.functionInstanceId === second.functionInstanceId,
        firstInvocationOnInstance: first.instanceInvocation === 1,
        caveat: 'Sequential calls are not guaranteed to hit the same Vercel instance; confirm cold/warm state and peak memory in Vercel runtime logs.',
      }, null, 2))
    }
  }
}
