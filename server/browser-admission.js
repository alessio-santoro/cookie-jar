export const BROWSER_EXECUTION_TIMEOUT_MS = 35000

export class BrowserAdmissionError extends Error {
  constructor(status, code, message, retryAfterSeconds = null) {
    super(message)
    this.name = 'BrowserAdmissionError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function abortError(signal) {
  return signal.reason instanceof BrowserAdmissionError
    ? signal.reason
    : new BrowserAdmissionError(499, 'AUDIT_CANCELLED', 'The browser operation was cancelled.')
}

export function waitForBrowserOperation(operation, signal) {
  if (!signal) return Promise.resolve(operation)
  if (signal.aborted) return Promise.reject(abortError(signal))

  let onAbort
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
  })

  return Promise.race([operation, aborted]).finally(() => {
    signal.removeEventListener('abort', onAbort)
  })
}

export function createBrowserAdmission(
  execute,
  { timeoutMs = BROWSER_EXECUTION_TIMEOUT_MS } = {},
) {
  if (typeof execute !== 'function') {
    throw new TypeError('execute must be a function.')
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer.')
  }

  let active = false
  return async function run(input, { signal: externalSignal } = {}) {
    if (externalSignal?.aborted) throw abortError(externalSignal)
    if (active) {
      throw new BrowserAdmissionError(
        429,
        'AUDIT_BUSY',
        'A local website check is already running. Try again shortly.',
        1,
      )
    }

    active = true
    const controller = new AbortController()
    let timeout
    let onExternalAbort
    const execution = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw abortError(controller.signal)
      return execute(input, { signal: controller.signal })
    })
    const competitors = [execution]

    competitors.push(new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        const error = new BrowserAdmissionError(
          504,
          'AUDIT_TIMEOUT',
          'The local website check exceeded its time limit.',
        )
        controller.abort(error)
        reject(error)
      }, timeoutMs)
    }))

    if (externalSignal) {
      competitors.push(new Promise((resolve, reject) => {
        onExternalAbort = () => {
          const error = abortError(externalSignal)
          controller.abort(error)
          reject(error)
        }
        externalSignal.addEventListener('abort', onExternalAbort, { once: true })
      }))
    }

    try {
      return await Promise.race(competitors)
    } catch (error) {
      if (!controller.signal.aborted) controller.abort(error)
      await Promise.allSettled([execution])
      throw error
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', onExternalAbort)
      active = false
    }
  }
}
