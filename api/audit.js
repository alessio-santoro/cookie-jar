import { randomUUID, timingSafeEqual } from 'node:crypto'
import { runBrowserSpike } from '../server/browser-spike.js'

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}
let instanceInvocation = 0
const functionInstanceId = randomUUID()

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, { ...jsonHeaders, ...extraHeaders })
  response.end(JSON.stringify(body))
}

function matchesToken(authorization, expectedToken) {
  if (!expectedToken || !authorization?.startsWith('Bearer ')) return false
  const provided = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(expectedToken)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export function createAuditHandler({
  runSpike = runBrowserSpike,
  enabled = process.env.COOKIEJAR_SPIKE_ENABLED,
  token = process.env.COOKIEJAR_SPIKE_TOKEN,
  deploymentEnvironment = process.env.VERCEL_ENV,
} = {}) {
  return async function audit(request, response) {
    if (request.method !== 'POST') {
      sendJson(
        response,
        405,
        {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Use POST to request the controlled browser check.',
          requestId: randomUUID(),
        },
        { Allow: 'POST' },
      )
      return
    }

    if (enabled !== 'true' || !token || deploymentEnvironment !== 'preview') {
      sendJson(response, 503, {
        code: 'AUDIT_UNAVAILABLE',
        message: 'Website checks are not available.',
        requestId: randomUUID(),
      })
      return
    }

    if (!matchesToken(request.headers.authorization, token)) {
      sendJson(response, 401, {
        code: 'UNAUTHORIZED',
        message: 'A valid preview authorization token is required.',
        requestId: randomUUID(),
      }, { 'WWW-Authenticate': 'Bearer' })
      return
    }

    const requestId = randomUUID()
    try {
      instanceInvocation += 1
      const report = await runSpike()
      sendJson(response, 200, {
        requestId,
        functionInstanceId,
        instanceInvocation,
        functionUptimeMs: Math.round(process.uptime() * 1000),
        ...report,
      })
    } catch {
      console.error(JSON.stringify({
        code: 'BROWSER_SPIKE_FAILED',
        requestId,
      }))
      sendJson(response, 500, {
        code: 'BROWSER_SPIKE_FAILED',
        message: 'The controlled browser check could not be completed.',
        requestId,
      })
    }
  }
}

export default createAuditHandler()
