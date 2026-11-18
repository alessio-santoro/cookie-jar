import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'
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

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('website address form', () => {
  it('associates invalid address feedback and makes no API request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox', { name: 'Website address' }), 'not a URL')
    await user.click(screen.getByRole('button', { name: 'Check website' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a public HTTP or HTTPS website address',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('supports Enter, announces pending work, and prevents duplicate submissions', async () => {
    const pendingResponse = deferred()
    const fetchMock = vi.fn().mockReturnValue(pendingResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('textbox', { name: 'Website address' })
    const button = screen.getByRole('button', { name: 'Check website' })

    await user.type(input, 'https://example.com')
    await user.keyboard('{Enter}')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Sending your request')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingResponse.resolve(response(200, validAuditReport))
    })
    expect(await screen.findByRole('heading', { name: 'Tracking cookies detected' })).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('uses the edited address and suppresses a stale response', async () => {
    const firstResponse = deferred()
    const secondResponse = deferred()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('textbox', { name: 'Website address' })

    await user.type(input, 'https://old.example')
    await user.click(screen.getByRole('button', { name: 'Check website' }))
    await user.clear(input)
    await user.type(input, 'https://new.example')
    await user.click(screen.getByRole('button', { name: 'Check website' }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      url: 'https://new.example',
    })

    const newReport = {
      ...validAuditReport,
      requestedUrl: 'https://new.example/',
      finalUrl: 'https://new.example/',
    }
    await act(async () => {
      secondResponse.resolve(response(200, newReport))
    })
    expect(await screen.findAllByText(/https:\/\/new\.example\//)).toHaveLength(2)

    const oldReport = {
      ...validAuditReport,
      requestedUrl: 'https://old.example/',
      finalUrl: 'https://old.example/',
    }
    await act(async () => {
      firstResponse.resolve(response(200, oldReport))
    })
    expect(screen.queryByText(/https:\/\/old\.example\//)).not.toBeInTheDocument()
  })

  it('clears a previous success on failure and allows retry', async () => {
    const retryReport = {
      ...validAuditReport,
      requestedUrl: 'https://retry.example/',
      finalUrl: 'https://retry.example/',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, validAuditReport))
      .mockResolvedValueOnce(response(503, validAuditError))
      .mockResolvedValueOnce(response(200, retryReport))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('textbox', { name: 'Website address' })
    const button = screen.getByRole('button', { name: 'Check website' })

    await user.type(input, 'https://example.com')
    await user.click(button)
    expect(await screen.findByRole('heading', { name: 'Tracking cookies detected' })).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'https://retry.example')
    expect(screen.queryByRole('heading', { name: 'Tracking cookies detected' })).not.toBeInTheDocument()
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Website checks are unavailable because required browser or network protections could not start.',
    )
    expect(screen.queryByRole('heading', { name: 'Tracking cookies detected' })).not.toBeInTheDocument()

    await user.click(button)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tracking cookies detected' })).toBeInTheDocument()
    })
    expect(screen.getAllByText(/https:\/\/retry\.example\//)).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
