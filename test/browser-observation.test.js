import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  runBrowserObservation,
  runStalledNavigationFixtureForTest,
} from '../server/browser-observation.js'

test('observes complete cookie metadata in a fresh controlled browser visit', async () => {
  const controller = new AbortController()
  const cancelledObservation = runBrowserObservation({ signal: controller.signal })
  await assert.rejects(runBrowserObservation(), {
    status: 429,
    code: 'AUDIT_BUSY',
  })
  const cancelTimer = setTimeout(() => controller.abort(), 1000)
  await assert.rejects(cancelledObservation, { code: 'AUDIT_CANCELLED' })
  clearTimeout(cancelTimer)

  const result = await runBrowserObservation()
  const cookie = (name) => result.cookies.filter((item) => item.name === name)

  assert.equal(result.scope, 'local-controlled-fixture-only')
  assert.equal(result.initialCookieCount, 0)
  assert.match(result.requestedUrl, /\/start$/)
  assert.match(result.finalUrl, /\/page$/)
  assert.deepEqual(result.observation, {
    navigationTimeoutMs: 20000,
    networkIdleTimeoutMs: 3000,
    settleTimeMs: 2000,
  })
  assert.ok(cookie('fixture_http').some((item) => item.httpOnly))
  assert.equal(cookie('fixture_js').length, 1)
  assert.equal(cookie('fixture_delayed').length, 1)
  assert.ok(cookie('fixture_session').some((item) => item.expiresAt === null))
  assert.ok(cookie('fixture_persistent').some((item) => item.expiresAt !== null))
  assert.ok(cookie('fixture_cross_origin').some((item) => item.httpOnly))
  assert.deepEqual(cookie('fixture_duplicate').map((item) => item.path).sort(), [
    '/',
    '/nested',
  ])
  assert.equal(cookie('fixture_consent').length, 0)
  assert.equal(result.consentInteraction, 'none')
  assert.equal(result.serviceWorkersBlocked, true)
  assert.equal(result.browserSandboxDisabled, true)
  assert.ok(result.warnings.some((warning) => warning.includes('Network activity continued')))
  assert.equal(result.popupOpenedByPage, result.popupCount > 0)
  assert.equal(result.popupClosedCount, result.popupCount)
  assert.ok(result.durationMs >= result.observation.settleTimeMs)
  assert.ok(result.cookies.every((item) => !Object.hasOwn(item, 'value')))
})

test('cleans up a stalled navigation and recovers for a later fixture visit', async () => {
  await assert.rejects(
    runStalledNavigationFixtureForTest(),
    (error) => error.name === 'TimeoutError',
  )

  const result = await runBrowserObservation()
  assert.equal(result.initialCookieCount, 0)
  assert.ok(result.cookies.some((cookie) => cookie.name === 'fixture_http'))
})
