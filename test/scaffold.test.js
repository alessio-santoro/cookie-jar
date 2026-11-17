import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createAuditHandler } from '../api/audit.js'
import { isAuditError } from '../src/shared/audit-contract.js'
import { validAuditReport } from './fixtures/audit-contract.js'

let server
let origin

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { port: 0, preTransformRequests: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  await server.listen()
  const address = server.httpServer.address()
  assert.equal(address.address, '127.0.0.1')
  origin = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await server?.close()
})

test('serves the React entrypoint, compiles JSX, and renders the website form', async () => {
  const page = await fetch(origin)
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type'), /text\/html/)
  assert.match(await page.text(), /src="\/src\/main.jsx"/)

  for (const path of ['/src/main.jsx', '/src/App.jsx']) {
    const source = await fetch(`${origin}${path}`)
    assert.equal(source.status, 200)
    assert.match(source.headers.get('content-type'), /javascript/)
    assert.match(await source.text(), /jsxDEV/)
  }

  const { default: App } = await server.ssrLoadModule('/src/App.jsx')
  const markup = renderToStaticMarkup(createElement(App))
  assert.match(markup, /Check a website before you choose\./)
  assert.match(markup, /Website address/)
  assert.match(markup, /Check website/)
  assert.match(markup, /Live website checks are not enabled/)
})

test('keeps live targets disabled until the local safety gate is implemented', async () => {
  const response = await fetch(`${origin}/api/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ url: 'http://127.0.0.1' }),
  })

  assert.equal(response.status, 503)
  assert.match(response.headers.get('content-type'), /application\/json/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.code, 'AUDIT_UNAVAILABLE')
  assert.equal(body.message, 'Website checks are not available yet.')
  assert.equal(isAuditError(body), true)
  assert.equal('outcome' in body, false)
})

test('runs the documented request example against the local same-origin API', async () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  const exampleBody = readme.match(/--data '([^']+)'/)?.[1]
  assert.ok(exampleBody, 'README should include a JSON API request example')
  assert.match(readme, /Browser code uses the relative path `\/api\/audit`/)

  const response = await fetch(`${origin}/api/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: exampleBody,
  })

  assert.equal(response.status, 503)
  const error = await response.json()
  assert.equal(isAuditError(error), true)
  assert.equal(error.code, 'AUDIT_UNAVAILABLE')
})

test('rejects malformed JSON and invalid request payloads', async () => {
  const cases = [
    {
      headers: { 'Content-Type': 'application/json' },
      body: '{"url":',
      status: 400,
      code: 'INVALID_JSON',
    },
    {
      headers: { 'Content-Type': 'text/plain' },
      body: '{"url":"https://example.com"}',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://user:password@example.com' }),
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', extra: true }),
      status: 400,
      code: 'INVALID_REQUEST',
    },
  ]

  for (const { headers, body, status, code } of cases) {
    const response = await fetch(`${origin}/api/audit`, {
      method: 'POST',
      headers,
      body,
    })
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const error = await response.json()
    assert.equal(isAuditError(error), true)
    assert.equal(error.code, code)
    assert.equal('outcome' in error, false)
  }
})

test('rejects disallowed origins before reading or executing the request', async () => {
  const response = await fetch(`${origin}/api/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://attacker.example',
    },
    body: '{"url":',
  })

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const error = await response.json()
  assert.equal(isAuditError(error), true)
  assert.equal(error.code, 'ORIGIN_NOT_ALLOWED')
})

test('unsupported methods return JSON with the allowed method', async () => {
  const response = await fetch(`${origin}/api/audit`)

  assert.equal(response.status, 405)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('allow'), 'POST')
  assert.equal((await response.json()).code, 'METHOD_NOT_ALLOWED')
})

test('normalizes URLs and validates executor reports before returning success', async () => {
  let actualUrl
  let actualRequestId
  const handler = createAuditHandler({
    executeAudit: async (url, requestId) => {
      actualUrl = url
      actualRequestId = requestId
      return validAuditReport
    },
  })
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body) {
      this.body = body
    },
  }

  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { url: ' https://example.com/#fragment ' },
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['Cache-Control'], 'no-store')
  assert.equal(actualUrl, 'https://example.com/')
  assert.match(actualRequestId, /^[0-9a-f-]{36}$/)
  assert.deepEqual(JSON.parse(response.body), validAuditReport)
})

test('removes query strings and fragments from successful report URLs', async () => {
  const report = {
    ...validAuditReport,
    requestedUrl: 'https://example.com/start?token=request-secret#private-fragment',
    finalUrl: 'https://example.com/end?token=redirect-secret#private-fragment',
  }
  let executedUrl
  const handler = createAuditHandler({
    executeAudit: async (url) => {
      executedUrl = url
      return report
    },
    logger: { error() {} },
  })
  const response = {
    setHeader() {},
    end(body) {
      this.body = body
    },
  }

  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { url: 'https://example.com/start?token=request-secret#private-fragment' },
  }, response)

  const safeReport = JSON.parse(response.body)
  assert.equal(response.statusCode, 200)
  assert.equal(executedUrl, 'https://example.com/start?token=request-secret')
  assert.equal(safeReport.requestedUrl, 'https://example.com/start')
  assert.equal(safeReport.finalUrl, 'https://example.com/end')
  assert.doesNotMatch(response.body, /request-secret|redirect-secret|private-fragment/)
})

test('returns a safe error instead of an invalid executor report', async () => {
  const diagnostics = []
  const handler = createAuditHandler({
    executeAudit: async () => {
      const report = structuredClone(validAuditReport)
      report.cookies[0].value = 'cookie-secret'
      return report
    },
    logger: { error: (line) => diagnostics.push(line) },
  })
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body) {
      this.body = body
    },
  }

  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { url: 'https://example.com' },
  }, response)

  assert.equal(response.statusCode, 500)
  const error = JSON.parse(response.body)
  assert.equal(isAuditError(error), true)
  assert.equal(error.code, 'INVALID_AUDIT_REPORT')
  assert.equal('outcome' in error, false)
  assert.doesNotMatch(response.body, /cookie-secret/)
  assert.doesNotMatch(diagnostics.join('\n'), /cookie-secret/)
  assert.deepEqual(diagnostics.map((line) => JSON.parse(line)), [{
    requestId: error.requestId,
    code: 'INVALID_AUDIT_REPORT',
  }])
})

test('sanitizes diagnostics and errors for token-bearing URLs and raw executor exceptions', async () => {
  const diagnostics = []
  const handler = createAuditHandler({
    executeAudit: async () => {
      throw new Error(
        'Navigation failed at https://example.com/private?token=query-secret cookie=cookie-secret',
      )
    },
    logger: { error: (line) => diagnostics.push(line) },
  })
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body) {
      this.body = body
    },
  }

  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { url: 'https://example.com/?token=query-secret' },
  }, response)

  const error = JSON.parse(response.body)
  const applicationLog = diagnostics.join('\n')
  assert.equal(response.statusCode, 500)
  assert.equal(response.headers['Cache-Control'], 'no-store')
  assert.equal(isAuditError(error), true)
  assert.equal(error.code, 'AUDIT_FAILED')
  assert.doesNotMatch(JSON.stringify(error), /query-secret|cookie-secret|example\.com/)
  assert.doesNotMatch(applicationLog, /query-secret|cookie-secret|example\.com/)
  assert.deepEqual(diagnostics.map((line) => JSON.parse(line)), [{
    requestId: error.requestId,
    code: 'AUDIT_FAILED',
  }])
})

test('unknown API paths and API source paths do not fall through to the SPA', async () => {
  for (const path of ['/api/unknown', '/api/audit/extra', '/api/audit.js']) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not found')
  }
})
