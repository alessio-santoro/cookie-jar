import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'
import {
  createBrowserAdmission,
  waitForBrowserOperation,
} from './browser-admission.js'

const OBSERVATION = Object.freeze({
  navigationTimeoutMs: 20000,
  networkIdleTimeoutMs: 3000,
  settleTimeMs: 2000,
})

function listenLoopback(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function closeServer(server) {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  })
}

function createPrimaryFixture(marker, basePath, getCrossOriginUrl, stallNavigation) {
  return createServer((request, response) => {
    if (request.url === `${basePath}/start`) {
      if (stallNavigation) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.write('<!doctype html><title>Stalled fixture response</title>')
        return
      }
      response.writeHead(302, { Location: `${basePath}/page` }).end()
      return
    }

    if (request.url === `${basePath}/hold`) {
      response.writeHead(200, { 'Content-Type': 'text/plain' })
      response.write('hold')
      return
    }

    if (request.url !== `${basePath}/page`) {
      response.writeHead(404).end()
      return
    }

    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        `fixture_http=${marker}; HttpOnly; SameSite=Lax; Path=/`,
        `fixture_session=${marker}; SameSite=Lax; Path=/`,
        `fixture_persistent=${marker}; Max-Age=3600; SameSite=Lax; Path=/`,
        `fixture_duplicate=${marker}; SameSite=Lax; Path=/`,
        `fixture_duplicate=${marker}; SameSite=Lax; Path=/nested`,
      ],
    })
    response.end(`<!doctype html>
      <title>CookieJar controlled observation fixture</title>
      <script>
        document.cookie = 'fixture_js=${marker}; SameSite=Lax; Path=/'
        setTimeout(() => {
          document.cookie = 'fixture_delayed=${marker}; SameSite=Lax; Path=/'
        }, 500)
        fetch('${basePath}/hold').catch(() => {})
        window.__fixturePopupOpened = Boolean(window.open('${basePath}/popup', '_blank'))
        navigator.serviceWorker?.register('${basePath}/service-worker.js').catch(() => {})
      </script>
      <script src="${getCrossOriginUrl()}"></script>
      <button onclick="document.cookie='fixture_consent=accepted; Path=/'">
        Accept consent
      </button>`)
  })
}

function createCrossOriginFixture(marker, path) {
  return createServer((request, response) => {
    if (request.url !== path) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Set-Cookie': `fixture_cross_origin=${marker}; HttpOnly; SameSite=Lax; Path=/`,
    })
    response.end('globalThis.__crossOriginFixtureLoaded = true')
  })
}

function includesCookie(cookies, name, predicate = () => true) {
  return cookies.some((cookie) => cookie.name === name && predicate(cookie))
}

export function createBrowserEnvironment(environment = process.env) {
  return {
    PATH: environment.PATH ?? '',
    HOME: '/tmp',
    TMPDIR: '/tmp',
    LANG: 'en_US.UTF-8',
    LD_LIBRARY_PATH: environment.LD_LIBRARY_PATH ?? '',
  }
}

async function captureBrowserObservation({
  stallNavigation = false,
  navigationTimeoutMs = OBSERVATION.navigationTimeoutMs,
} = {}, { signal }) {
  const started = performance.now()
  const marker = randomUUID()
  const basePath = `/fixture-${marker}`
  const crossOriginPath = `/cross-origin-${marker}.js`
  let crossOriginUrl
  const primaryFixture = createPrimaryFixture(
    marker,
    basePath,
    () => crossOriginUrl,
    stallNavigation,
  )
  const crossOriginFixture = createCrossOriginFixture(marker, crossOriginPath)
  let browserServer
  let browser
  let context

  try {
    await waitForBrowserOperation(Promise.all([
      listenLoopback(primaryFixture),
      listenLoopback(crossOriginFixture),
    ]), signal)
    const primaryOrigin = `http://127.0.0.1:${primaryFixture.address().port}`
    const crossOrigin = `http://127.0.0.1:${crossOriginFixture.address().port}`
    const requestedUrl = `${primaryOrigin}${basePath}/start`
    const finalUrl = `${primaryOrigin}${basePath}/page`
    crossOriginUrl = `${crossOrigin}${crossOriginPath}`
    const holdUrl = `${primaryOrigin}${basePath}/hold`
    const allowedFixtureUrls = new Set([
      requestedUrl,
      finalUrl,
      crossOriginUrl,
      holdUrl,
    ])

    browserServer = await playwright.launchServer({
      executablePath: await waitForBrowserOperation(chromium.executablePath(), signal),
      args: chromium.args,
      headless: true,
      timeout: OBSERVATION.navigationTimeoutMs,
      env: createBrowserEnvironment(process.env),
    })
    await waitForBrowserOperation(Promise.resolve(), signal)
    browser = await playwright.connect(browserServer.wsEndpoint())
    context = await waitForBrowserOperation(browser.newContext({
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'block',
    }), signal)
    const initialCookieCount = (await waitForBrowserOperation(context.cookies(), signal)).length
    const page = await waitForBrowserOperation(context.newPage(), signal)
    const popups = []
    let blockedRequests = 0
    context.on('page', (openedPage) => {
      if (openedPage !== page) popups.push(openedPage)
    })
    await waitForBrowserOperation(context.route('**/*', async (route) => {
      if (allowedFixtureUrls.has(route.request().url())) {
        await route.continue()
      } else {
        blockedRequests += 1
        await route.abort()
      }
    }), signal)
    await waitForBrowserOperation(
      context.routeWebSocket('**/*', (socket) => socket.close()),
      signal,
    )

    const response = await waitForBrowserOperation(page.goto(requestedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    }), signal)
    if (response?.status() !== 200 || page.url() !== finalUrl) {
      throw new Error('Owned fixture navigation failed.')
    }

    const warnings = []
    try {
      await waitForBrowserOperation(page.waitForLoadState('networkidle', {
        timeout: OBSERVATION.networkIdleTimeoutMs,
      }), signal)
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error
      warnings.push(
        'Network activity continued after the bounded idle wait; capture proceeded.',
      )
    }

    await waitForBrowserOperation(page.waitForTimeout(OBSERVATION.settleTimeMs), signal)
    const popupOpenedByPage = await waitForBrowserOperation(
      page.evaluate(() => globalThis.__fixturePopupOpened),
      signal,
    )
    await Promise.all(popups.map((popup) => popup.close()))
    if (popups.length > 0) warnings.push('A popup window was blocked.')
    if (blockedRequests > 0) {
      warnings.push('A request outside the owned fixture was blocked.')
    }

    const capturedCookies = await waitForBrowserOperation(context.cookies(), signal)
    const verification = {
      freshContext: initialCookieCount === 0,
      httpOnly: includesCookie(capturedCookies, 'fixture_http', (cookie) => cookie.httpOnly),
      javascript: includesCookie(capturedCookies, 'fixture_js'),
      delayed: includesCookie(capturedCookies, 'fixture_delayed'),
      session: includesCookie(capturedCookies, 'fixture_session', (cookie) => cookie.expires === -1),
      persistent: includesCookie(capturedCookies, 'fixture_persistent', (cookie) => cookie.expires > 0),
      crossOrigin: includesCookie(capturedCookies, 'fixture_cross_origin', (cookie) => cookie.httpOnly),
      duplicateNameAndPath: capturedCookies.filter(
        (cookie) => cookie.name === 'fixture_duplicate',
      ).length === 2,
      consentUntouched: !includesCookie(capturedCookies, 'fixture_consent'),
    }
    if (Object.values(verification).some((verified) => !verified)) {
      const observedNames = capturedCookies.map((cookie) => cookie.name)
      throw new Error(
        `Owned fixture cookie verification failed: ${JSON.stringify({ verification, observedNames })}`,
      )
    }

    return {
      scope: 'local-controlled-fixture-only',
      requestedUrl,
      finalUrl: page.url(),
      capturedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      observation: { ...OBSERVATION },
      initialCookieCount,
      cookies: capturedCookies.map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expiresAt: cookie.expires === -1
          ? null : new Date(cookie.expires * 1000).toISOString(),
      })),
      warnings,
      popupOpenedByPage,
      popupCount: popups.length,
      popupClosedCount: popups.length,
      blockedRequestCount: blockedRequests,
      serviceWorkersBlocked: true,
      browserSandboxDisabled: chromium.args.includes('--no-sandbox'),
      consentInteraction: 'none',
    }
  } finally {
    try {
      await context?.close()
    } finally {
      try {
        await browser?.close()
      } finally {
        try {
          await browserServer?.close()
        } finally {
          await Promise.all([
            closeServer(primaryFixture),
            closeServer(crossOriginFixture),
          ])
        }
      }
    }
  }
}

const observationAdmission = createBrowserAdmission(
  (input, options) => captureBrowserObservation(input, options),
)

export function runBrowserObservation(options = {}) {
  return observationAdmission(undefined, options)
}

export function runStalledNavigationFixtureForTest(timeoutMs = 100) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer.')
  }
  return observationAdmission({
    stallNavigation: true,
    navigationTimeoutMs: timeoutMs,
  })
}
