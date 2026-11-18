import { randomUUID } from 'node:crypto'
import { isAuditError, isAuditReport, isAuditRequest } from '../src/shared/audit-contract.js'
import {
  BrowserAdmissionError,
} from '../server/browser-admission.js'
import {
  BrowserAuditError,
  runBrowserAudit,
} from '../server/browser-audit.js'
import {
  BrowserNetworkBoundaryError,
} from '../server/browser-network.js'
import {
  DestinationPolicyError,
} from '../server/destination-policy.js'

const MAX_REQUEST_BYTES = 16 * 1024

class RequestError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function sendJson(response, status, body) {
  response.statusCode = status
  response.end(JSON.stringify(body))
}

function sendError(response, status, code, message, requestId) {
  const body = { code, message, requestId }
  if (!isAuditError(body)) {
    throw new TypeError('Generated API error does not match the audit error contract.')
  }
  sendJson(response, status, body)
}

function logDiagnostic(logger, requestId, code) {
  logger.error(JSON.stringify({ requestId, code }))
}

function expectedOrigin(request) {
  const host = request.headers.host
  if (typeof host !== 'string' || host.length === 0) return null

  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : request.socket?.encrypted
      ? 'https'
      : 'http'
  if (!['http', 'https'].includes(protocol)) return null

  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return null
  }
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin
  if (origin === undefined) return true
  if (typeof origin !== 'string' || origin === 'null') return false

  let parsedOrigin
  try {
    parsedOrigin = new URL(origin)
  } catch {
    return false
  }

  return ['http:', 'https:'].includes(parsedOrigin.protocol)
    && parsedOrigin.origin === origin
    && parsedOrigin.origin === expectedOrigin(request)
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestError(400, 'INVALID_JSON', 'Send a valid JSON request.')
    }
    throw error
  }
}

async function readJsonBody(request) {
  const contentType = request.headers['content-type']
  if (typeof contentType !== 'string'
    || contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Send the request as application/json.',
    )
  }

  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new RequestError(413, 'REQUEST_TOO_LARGE', 'The request is too large.')
  }

  if (request.body !== undefined) {
    if (typeof request.body === 'string') return parseJson(request.body)
    if (Buffer.isBuffer(request.body)) return parseJson(request.body.toString('utf8'))
    return request.body
  }

  const chunks = []
  let totalBytes = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += bytes.length
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new RequestError(413, 'REQUEST_TOO_LARGE', 'The request is too large.')
    }
    chunks.push(bytes)
  }

  return parseJson(Buffer.concat(chunks).toString('utf8'))
}

function normalizeAuditUrl(url) {
  const normalized = new URL(url.trim())
  normalized.hash = ''
  return normalized.toString()
}

function redactAuditUrl(url) {
  const redacted = new URL(url)
  redacted.search = ''
  redacted.hash = ''
  return redacted.toString()
}

export function createAuditHandler({ executeAudit, logger = console } = {}) {
  if (executeAudit !== undefined && typeof executeAudit !== 'function') {
    throw new TypeError('executeAudit must be a function when provided.')
  }
  if (typeof logger?.error !== 'function') {
    throw new TypeError('logger must provide an error function.')
  }

  return async function audit(request, response) {
    const requestId = randomUUID()
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      sendError(
        response,
        405,
        'METHOD_NOT_ALLOWED',
        'Use POST to request a website check.',
        requestId,
      )
      return
    }

    if (!isAllowedOrigin(request)) {
      sendError(
        response,
        403,
        'ORIGIN_NOT_ALLOWED',
        'This website origin cannot submit checks.',
        requestId,
      )
      return
    }

    let payload
    try {
      payload = await readJsonBody(request)
    } catch (error) {
      if (error instanceof RequestError) {
        sendError(response, error.status, error.code, error.message, requestId)
      } else {
        sendError(
          response,
          400,
          'INVALID_REQUEST',
          'The request could not be read.',
          requestId,
        )
      }
      return
    }

    if (!isAuditRequest(payload)) {
      sendError(
        response,
        400,
        'INVALID_REQUEST',
        'Provide a valid HTTP or HTTPS website address.',
        requestId,
      )
      return
    }

    if (executeAudit === undefined) {
      sendError(
        response,
        503,
        'AUDIT_UNAVAILABLE',
        'Website checks are not available yet.',
        requestId,
      )
      return
    }

    const controller = new AbortController()
    const abortOnDisconnect = () => controller.abort()
    const abortOnResponseClose = () => {
      if (!response.writableEnded) controller.abort()
    }
    request.once?.('aborted', abortOnDisconnect)
    response.once?.('close', abortOnResponseClose)
    try {
      if (request.aborted) controller.abort()
      const report = await executeAudit(
        normalizeAuditUrl(payload.url),
        requestId,
        { signal: controller.signal },
      )
      if (!isAuditReport(report)) {
        logDiagnostic(logger, requestId, 'INVALID_AUDIT_REPORT')
        sendError(
          response,
          500,
          'INVALID_AUDIT_REPORT',
          'The website check could not be completed.',
          requestId,
        )
        return
      }
      const safeReport = {
        ...report,
        requestedUrl: redactAuditUrl(report.requestedUrl),
        finalUrl: redactAuditUrl(report.finalUrl),
      }
      if (!isAuditReport(safeReport)) {
        logDiagnostic(logger, requestId, 'INVALID_AUDIT_REPORT')
        sendError(
          response,
          500,
          'INVALID_AUDIT_REPORT',
          'The website check could not be completed.',
          requestId,
        )
        return
      }
      sendJson(response, 200, safeReport)
    } catch (error) {
      const knownError = error instanceof BrowserAdmissionError
        || error instanceof BrowserAuditError
        || error instanceof BrowserNetworkBoundaryError
        || error instanceof DestinationPolicyError
      const status = knownError ? error.status : 500
      const code = knownError ? error.code : 'AUDIT_FAILED'
      const message = knownError
        ? error.message
        : 'The website check could not be completed.'
      logDiagnostic(logger, requestId, code)
      if (response.destroyed || response.writableEnded) return
      if (knownError && typeof error.retryAfterSeconds === 'number') {
        response.setHeader('Retry-After', String(error.retryAfterSeconds))
      }
      sendError(response, status, code, message, requestId)
    } finally {
      request.removeListener?.('aborted', abortOnDisconnect)
      response.removeListener?.('close', abortOnResponseClose)
    }
  }
}

export default createAuditHandler({ executeAudit: runBrowserAudit })
