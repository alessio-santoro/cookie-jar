import { performance } from 'node:perf_hooks'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'
import { classifyCookies } from '../src/shared/cookie-classifier.js'
import {
  createBrowserAdmission,
  BrowserAdmissionError,
  waitForBrowserOperation,
} from './browser-admission.js'
import { createBrowserEnvironment } from './browser-environment.js'
import { createBrowserNetworkBoundary } from './browser-network.js'
import { DestinationPolicyError, validatePublicTarget } from './destination-policy.js'

const OBSERVATION = Object.freeze({
  navigationTimeoutMs: 20000,
  networkIdleTimeoutMs: 3000,
  settleTimeMs: 2000,
})

export class BrowserAuditError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'BrowserAuditError'
    this.status = status
    this.code = code
  }
}

function unsafeTarget(code = 'UNSAFE_TARGET') {
  return new DestinationPolicyError(
    code,
    code === 'INVALID_TARGET'
      ? 'A browser request used an unsupported destination.'
      : 'A browser request to a non-public destination was blocked.',
  )
}

function rejectedNavigationError(url, rejectedRequests) {
  let origin
  try {
    origin = new URL(url).origin
  } catch {
    return null
  }
  const rejection = rejectedRequests.find((item) => item.origin === origin)
  return rejection ? unsafeTarget(rejection.code) : null
}

function isNavigationRequest(request, page) {
  if (!request.isNavigationRequest()) return false
  try {
    return request.frame() === page.mainFrame()
  } catch {
    return false
  }
}

async function captureAudit(url, {
  signal,
  createNetworkBoundary,
  launchBrowser,
  validateTarget,
}) {
  const started = performance.now()
  const requestedUrl = await validateTarget(url)
  await waitForBrowserOperation(Promise.resolve(), signal)

  const browserPath = await waitForBrowserOperation(chromium.executablePath(), signal)
  const network = await createNetworkBoundary({
    chromiumPath: browserPath,
    environment: createBrowserEnvironment(process.env),
  })
  let browser
  let context

  try {
    await waitForBrowserOperation(Promise.resolve(), signal)
    try {
      browser = await launchBrowser({
        executablePath: network.executablePath,
        args: chromium.args,
        env: network.environment,
        headless: true,
        timeout: 15000,
      })
    } catch {
      if (signal?.aborted) {
        throw signal.reason instanceof BrowserAdmissionError
          ? signal.reason
          : new BrowserAdmissionError(
            499,
            'AUDIT_CANCELLED',
            'The browser operation was cancelled.',
          )
      }
      throw new BrowserAuditError(
        503,
        'BROWSER_RUNTIME_UNAVAILABLE',
        'Live website checks are unavailable because the browser could not start securely.',
      )
    }
    await waitForBrowserOperation(Promise.resolve(), signal)
    context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'block',
    })
    await waitForBrowserOperation(Promise.resolve(), signal)
    const page = await context.newPage()
    const popupPages = new Set()
    const failedMainNavigationUrls = new Set()
    context.on('page', (openedPage) => {
      if (openedPage !== page) popupPages.add(openedPage)
    })
    page.on('requestfailed', (request) => {
      if (isNavigationRequest(request, page)) {
        failedMainNavigationUrls.add(request.url())
      }
    })

    let response
    try {
      response = await waitForBrowserOperation(page.goto(requestedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: OBSERVATION.navigationTimeoutMs,
      }), signal)
    } catch (error) {
      const rejectedRequests = network.getRejectedRequests()
      for (const failedUrl of failedMainNavigationUrls) {
        const rejection = rejectedNavigationError(failedUrl, rejectedRequests)
        if (rejection) throw rejection
      }
      if (error instanceof BrowserAdmissionError) throw error
      if (error.name === 'TimeoutError') {
        throw new BrowserAdmissionError(
          504,
          'AUDIT_TIMEOUT',
          'The website did not finish loading within the time limit.',
        )
      }
      throw new BrowserAuditError(
        502,
        'TARGET_UNAVAILABLE',
        'The website could not be reached.',
      )
    }

    const mainDocumentRejection = rejectedNavigationError(
      response?.url() ?? page.url(),
      network.getRejectedRequests(),
    )
    if (mainDocumentRejection) throw mainDocumentRejection
    if (!response || response.status() >= 400) {
      throw new BrowserAuditError(
        502,
        'TARGET_HTTP_ERROR',
        'The website returned an HTTP error during the visit.',
      )
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
    await Promise.all([...popupPages].map((popup) => popup.close()))
    if (popupPages.size > 0) warnings.push('A popup window was blocked.')

    const rejectedRequests = network.getRejectedRequests()
    if (rejectedRequests.length > 0) {
      warnings.push('One or more browser subrequests were blocked by destination protections.')
    }
    const classified = classifyCookies(
      await waitForBrowserOperation(context.cookies(), signal),
    )

    return {
      requestedUrl,
      finalUrl: page.url(),
      capturedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      outcome: classified.outcome,
      summary: classified.summary,
      observation: { ...OBSERVATION },
      warnings,
      cookies: classified.cookies,
    }
  } finally {
    try {
      await context?.close()
    } finally {
      try {
        await browser?.close()
      } finally {
        await network.close()
      }
    }
  }
}

export function createBrowserAuditExecutor({
  createNetworkBoundary = createBrowserNetworkBoundary,
  launchBrowser = (options) => playwright.launch(options),
  validateTarget = validatePublicTarget,
} = {}) {
  if (typeof createNetworkBoundary !== 'function'
    || typeof launchBrowser !== 'function'
    || typeof validateTarget !== 'function') {
    throw new TypeError('Browser audit dependencies must be functions.')
  }

  const admitted = createBrowserAdmission((url, options) => captureAudit(url, {
    ...options,
    createNetworkBoundary,
    launchBrowser,
    validateTarget,
  }))

  return async function executeBrowserAudit(url, _requestId, options = {}) {
    return admitted(url, options)
  }
}

export const runBrowserAudit = createBrowserAuditExecutor()
