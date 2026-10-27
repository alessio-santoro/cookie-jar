import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runBrowserSpike } from '../server/browser-spike.js'

test('real packaged Chromium captures only fixture cookies in two fresh visits', {
  timeout: 60000,
}, async () => {
  for (let invocation = 0; invocation < 2; invocation += 1) {
    const result = await runBrowserSpike()
    assert.match(result.browserVersion, /^153\./)
    assert.equal(result.initialCookieCount, 0)
    assert.deepEqual(result.cookies.map((cookie) => cookie.name).sort(),
      ['fixture_http', 'fixture_js'])
    assert.equal(result.cookies.find((cookie) => cookie.name === 'fixture_http').httpOnly, true)
    assert.ok(result.browserStartupMs > 0)
    assert.ok(result.nodeRssBytes > 0)
    assert.ok(result.browserParentRssBytes === null || result.browserParentRssBytes > 0)
    assert.ok(result.cookies.every((cookie) => !('value' in cookie)))
  }
})
