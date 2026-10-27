import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let origin

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, preTransformRequests: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
})

after(async () => {
  await server?.close()
})

test('serves the React entrypoint, compiles JSX, and renders the placeholder', async () => {
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
  assert.match(markup, /<h1>CookieJar<\/h1>/)
  assert.match(markup, /Website checks are not available yet\./)
})

test('routes same-origin POST to the disabled audit function, not the SPA', async () => {
  const response = await fetch(`${origin}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  })

  assert.equal(response.status, 503)
  assert.match(response.headers.get('content-type'), /application\/json/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.code, 'AUDIT_UNAVAILABLE')
  assert.equal(body.message, 'Website checks are not available.')
  assert.match(body.requestId, /^[0-9a-f-]{36}$/)
  assert.equal('outcome' in body, false)
})

test('unsupported methods return JSON with the allowed method', async () => {
  const response = await fetch(`${origin}/api/audit`)

  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'POST')
  assert.equal((await response.json()).code, 'METHOD_NOT_ALLOWED')
})

test('unknown API paths and API source paths do not fall through to the SPA', async () => {
  for (const path of ['/api/unknown', '/api/audit/extra', '/api/audit.js']) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not found')
  }
})
