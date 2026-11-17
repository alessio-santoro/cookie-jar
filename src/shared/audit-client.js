import { isAuditReport, isAuditRequest, isAuditError } from './audit-contract.js'

export const AUDIT_CLIENT_TIMEOUT_MS = 70_000

const HTTP_ERROR_MESSAGES = new Map([
  [400, 'That website address cannot be checked. Enter a valid HTTP or HTTPS URL.'],
  [403, 'This request was blocked because it did not come from this site.'],
  [405, 'Website checks are not available at this time.'],
  [413, 'The request could not be sent. Please refresh and try again.'],
  [415, 'The request could not be sent. Please refresh and try again.'],
  [429, 'Another website check is running. Wait a moment, then try again.'],
  [502, 'The website could not be reached. Check the address and try again.'],
  [503, 'Website checks are not available yet.'],
  [504, 'The website took too long to respond. Try again later.'],
])

export class AuditClientError extends Error {
  constructor(message, { code = 'AUDIT_REQUEST_FAILED', status = null } = {}) {
    super(message)
    this.name = 'AuditClientError'
    this.code = code
    this.status = status
  }
}

function createAbortError() {
  const error = new Error('The website check was cancelled.')
  error.name = 'AbortError'
  return error
}

function messageForStatus(status) {
  return HTTP_ERROR_MESSAGES.get(status)
    ?? 'The website check failed. Please try again.'
}

export async function requestAudit(url, { fetchImpl = fetch, signal } = {}) {
  if (!isAuditRequest({ url })) {
    throw new AuditClientError(
      'Enter a valid HTTP or HTTPS website address.',
      { code: 'INVALID_URL' },
    )
  }
  if (typeof fetchImpl !== 'function') {
    throw new AuditClientError('The website-check service could not be reached.', {
      code: 'NETWORK_ERROR',
    })
  }
  if (signal?.aborted) throw createAbortError()

  const controller = new AbortController()
  let timedOut = false
  const relayAbort = () => controller.abort()
  signal?.addEventListener('abort', relayAbort, { once: true })
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, AUDIT_CLIENT_TIMEOUT_MS)

  try {
    const response = await fetchImpl('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
      signal: controller.signal,
    })

    let payload
    try {
      payload = await response.json()
    } catch {
      if (!response.ok) {
        throw new AuditClientError(messageForStatus(response.status), {
          code: `HTTP_${response.status}`,
          status: response.status,
        })
      }
      throw new AuditClientError(
        'The website-check service returned an unreadable response.',
        { code: 'INVALID_RESPONSE', status: response.status },
      )
    }

    if (!response.ok) {
      throw new AuditClientError(messageForStatus(response.status), {
        code: isAuditError(payload) ? payload.code : `HTTP_${response.status}`,
        status: response.status,
      })
    }
    if (!isAuditReport(payload)) {
      throw new AuditClientError(
        'The website-check service returned an invalid result.',
        { code: 'INVALID_RESPONSE', status: response.status },
      )
    }

    return payload
  } catch (error) {
    if (signal?.aborted) throw createAbortError()
    if (timedOut) {
      throw new AuditClientError(
        'This check took too long. Try again later.',
        { code: 'CLIENT_TIMEOUT' },
      )
    }
    if (error instanceof AuditClientError) throw error
    throw new AuditClientError(
      'Could not connect to the website-check service. Check your connection and try again.',
      { code: 'NETWORK_ERROR' },
    )
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', relayAbort)
  }
}
