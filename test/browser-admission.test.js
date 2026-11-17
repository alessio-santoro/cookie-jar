import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BROWSER_EXECUTION_TIMEOUT_MS,
  BrowserAdmissionError,
  createBrowserAdmission,
} from '../server/browser-admission.js'
import { createBrowserEnvironment } from '../server/browser-observation.js'

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('admits only one browser operation and releases capacity after completion', async () => {
  const first = deferred()
  let executions = 0
  const run = createBrowserAdmission(async () => {
    executions += 1
    return first.promise
  }, { timeoutMs: 1000 })

  const active = run('owned-fixture')
  await assert.rejects(run('second-fixture'), (error) => (
    error instanceof BrowserAdmissionError
      && error.status === 429
      && error.code === 'AUDIT_BUSY'
      && error.retryAfterSeconds === 1
  ))
  first.resolve('captured')
  assert.equal(await active, 'captured')
  assert.equal(await run('owned-fixture'), 'captured')
  assert.equal(executions, 2)
})

test('uses the documented 35-second execution deadline', () => {
  assert.equal(BROWSER_EXECUTION_TIMEOUT_MS, 35000)
})

test('aborts on deadline, waits for cleanup, then admits the next operation', async () => {
  let cleanupComplete = false
  const run = createBrowserAdmission(async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      cleanupComplete = true
      reject(new Error('fixture process stopped'))
    }, { once: true })
  }), { timeoutMs: 10 })

  await assert.rejects(run('stalled-fixture'), (error) => (
    error instanceof BrowserAdmissionError
      && error.status === 504
      && error.code === 'AUDIT_TIMEOUT'
  ))
  assert.equal(cleanupComplete, true)
  assert.equal(await createBrowserAdmission(async () => 'recovered')(), 'recovered')
})

test('propagates request cancellation and waits for owned work to stop', async () => {
  const controller = new AbortController()
  let cleanupComplete = false
  const started = deferred()
  const run = createBrowserAdmission(async (_, { signal }) => {
    started.resolve()
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        cleanupComplete = true
        reject(new Error('fixture process stopped'))
      }, { once: true })
    })
  })

  const active = run('owned-fixture', { signal: controller.signal })
  await started.promise
  controller.abort()
  await assert.rejects(active, { code: 'AUDIT_CANCELLED' })
  assert.equal(cleanupComplete, true)
})

test('passes only the explicitly allowed environment values to Chromium', () => {
  assert.deepEqual(createBrowserEnvironment({
    PATH: '/usr/bin',
    HOME: '/home/user',
    LANG: 'C.UTF-8',
    LD_LIBRARY_PATH: '/lib',
    API_SECRET: 'not-forwarded',
    ACCESS_TOKEN: 'not-forwarded',
  }), {
    PATH: '/usr/bin',
    HOME: '/tmp',
    TMPDIR: '/tmp',
    LANG: 'en_US.UTF-8',
    LD_LIBRARY_PATH: '/lib',
  })
})
