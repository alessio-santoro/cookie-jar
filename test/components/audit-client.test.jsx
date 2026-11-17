import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIT_CLIENT_TIMEOUT_MS,
  AuditClientError,
  requestAudit,
} from '../../src/shared/audit-client.js'
import {
  validAuditError,
  validAuditReport,
} from '../fixtures/audit-contract.js'

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('requestAudit', () => {
  it('posts to the relative endpoint and returns a valid report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, validAuditReport))

    await expect(requestAudit(' https://example.com ', { fetchImpl }))
      .resolves.toEqual(validAuditReport)
    expect(fetchImpl).toHaveBeenCalledWith('/api/audit', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
      signal: expect.any(AbortSignal),
    }))
  })

  it('rejects invalid addresses without making a request', async () => {
    const fetchImpl = vi.fn()

    await expect(requestAudit('ftp://example.com', { fetchImpl }))
      .rejects.toMatchObject({ code: 'INVALID_URL' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects malformed or non-report responses instead of fabricating success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      outcome: 'PASS',
      cookies: [],
    }))

    await expect(requestAudit('https://example.com', { fetchImpl }))
      .rejects.toMatchObject({
        name: 'AuditClientError',
        code: 'INVALID_RESPONSE',
      })

    const htmlResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }
    await expect(requestAudit('https://example.com', {
      fetchImpl: vi.fn().mockResolvedValue(htmlResponse),
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('shows readable messages for request, busy, gateway, and timeout errors', async () => {
    const cases = [
      {
        status: 400,
        result: response(400, validAuditError),
        expectedMessage: /address cannot be checked/,
      },
      {
        status: 429,
        result: response(429, validAuditError),
        expectedMessage: /another website check is running/i,
      },
      {
        status: 502,
        result: {
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError('HTML platform error')
          },
        },
        expectedMessage: /could not be reached/i,
      },
      {
        status: 504,
        result: {
          ok: false,
          status: 504,
          json: async () => {
            throw new SyntaxError('HTML platform error')
          },
        },
        expectedMessage: /took too long/i,
      },
    ]

    for (const { status, result, expectedMessage } of cases) {
      await expect(requestAudit('https://example.com', {
        fetchImpl: vi.fn().mockResolvedValue(result),
      })).rejects.toMatchObject({
        name: 'AuditClientError',
        status,
        message: expect.stringMatching(expectedMessage),
      })
    }
  })

  it('reports timeout after 70 seconds and allows external cancellation', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('fetch aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    }))
    const pending = requestAudit('https://example.com', { fetchImpl })
    const timeoutAssertion = expect(pending).rejects.toBeInstanceOf(AuditClientError)
    const timeoutCodeAssertion = expect(pending).rejects.toMatchObject({
      code: 'CLIENT_TIMEOUT',
    })

    await vi.advanceTimersByTimeAsync(AUDIT_CLIENT_TIMEOUT_MS)
    await Promise.all([timeoutAssertion, timeoutCodeAssertion])

    const controller = new AbortController()
    const cancellableFetch = vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('fetch aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    }))
    const cancelled = requestAudit('https://example.com', {
      fetchImpl: cancellableFetch,
      signal: controller.signal,
    })
    controller.abort()

    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  })
})
