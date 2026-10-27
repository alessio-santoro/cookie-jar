import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import { createAuditHandler } from '../api/audit.js'

const secret = 'fixture-preview-token-which-is-long-enough'
let server
let origin
let runCount

before(async () => {
  runCount = 0
  server = createServer(createAuditHandler({
    enabled: 'true',
    token: secret,
    deploymentEnvironment: 'preview',
    runSpike: async () => {
      runCount += 1
      return {
        scope: 'local-controlled-fixture-only',
        cookies: [
          { name: 'fixture_http', httpOnly: true },
          { name: 'fixture_js', httpOnly: false },
        ],
      }
    },
  }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (!server?.listening) return
  server.closeAllConnections()
  server.close()
  await once(server, 'close')
})

test('keeps the spike disabled unless explicitly enabled', async () => {
  const disabled = createServer(createAuditHandler({
    enabled: 'false',
    token: secret,
    deploymentEnvironment: 'preview',
    runSpike: async () => assert.fail('disabled handler launched the browser'),
  }))
  disabled.listen(0, '127.0.0.1')
  await once(disabled, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${disabled.address().port}/api/audit`, {
      method: 'POST',
    })
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'AUDIT_UNAVAILABLE')
  } finally {
    disabled.closeAllConnections()
    disabled.close()
    await once(disabled, 'close')
  }
})

test('keeps the spike disabled outside Vercel Preview', async () => {
  const production = createServer(createAuditHandler({
    enabled: 'true',
    token: secret,
    deploymentEnvironment: 'production',
    runSpike: async () => assert.fail('non-preview handler launched the browser'),
  }))
  production.listen(0, '127.0.0.1')
  await once(production, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${production.address().port}/api/audit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'AUDIT_UNAVAILABLE')
  } finally {
    production.closeAllConnections()
    production.close()
    await once(production, 'close')
  }
})

test('requires a bearer token before launching Chromium', async () => {
  for (const authorization of [undefined, 'Bearer invalid-token']) {
    const response = await fetch(`${origin}/api/audit`, {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).code, 'UNAUTHORIZED')
  }
  assert.equal(runCount, 0)
})

test('returns fixture evidence without accepting or echoing a target URL', async () => {
  const response = await fetch(`${origin}/api/audit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: 'http://127.0.0.1:1234/private' }),
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type'), /application\/json/)
  const report = await response.json()
  assert.equal(report.scope, 'local-controlled-fixture-only')
  assert.match(report.functionInstanceId, /^[0-9a-f-]{36}$/)
  assert.equal(report.instanceInvocation, 1)
  assert.ok(report.functionUptimeMs > 0)
  assert.deepEqual(report.cookies, [
    { name: 'fixture_http', httpOnly: true },
    { name: 'fixture_js', httpOnly: false },
  ])
  assert.equal('url' in report, false)
  assert.equal(runCount, 1)
})

test('rejects unsupported methods before launching Chromium', async () => {
  const response = await fetch(`${origin}/api/audit`)
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'POST')
  assert.equal(runCount, 1)
})

test('converts runner failures to safe request-correlated errors', async () => {
  const failing = createServer(createAuditHandler({
    enabled: 'true',
    token: secret,
    deploymentEnvironment: 'preview',
    runSpike: async () => { throw new Error('sensitive local diagnostic') },
  }))
  failing.listen(0, '127.0.0.1')
  await once(failing, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${failing.address().port}/api/audit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    assert.equal(response.status, 500)
    const error = await response.json()
    assert.equal(error.code, 'BROWSER_SPIKE_FAILED')
    assert.match(error.requestId, /^[0-9a-f-]{36}$/)
    assert.doesNotMatch(JSON.stringify(error), /sensitive local diagnostic/)
  } finally {
    failing.closeAllConnections()
    failing.close()
    await once(failing, 'close')
  }
})
