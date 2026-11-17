import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CookieEvidence from '../../src/components/CookieEvidence.jsx'
import { validAuditReport } from '../fixtures/audit-contract.js'

describe('cookie evidence table', () => {
  it('labels session expiry and explains its limits', () => {
    render(<CookieEvidence cookies={validAuditReport.cookies} />)

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Domain' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Expiration' })).toBeInTheDocument()
    expect(screen.getByText('Session')).toBeInTheDocument()
    expect(screen.getByText(/not a guaranteed deletion time/)).toBeInTheDocument()
  })

  it('formats persistent expiration with an explicit timezone', () => {
    const cookie = {
      ...validAuditReport.cookies[0],
      expiresAt: '2027-01-02T03:04:05Z',
    }
    render(<CookieEvidence cookies={[cookie]} />)

    const expiration = screen.getByText((_, element) => element?.tagName === 'TIME')
    expect(expiration).toHaveAttribute('dateTime', cookie.expiresAt)
    expect(expiration.textContent).toMatch(/2027/)
    expect(expiration.textContent).toMatch(/GMT|UTC|[A-Z]{3}/)
  })

  it('makes row details keyboard-reachable and reveals provider and path', async () => {
    const user = userEvent.setup()
    render(<CookieEvidence cookies={validAuditReport.cookies} />)

    const region = screen.getByRole('region', { name: 'Cookie evidence table' })
    const details = screen.getByText('More details')
    expect(details).toHaveAttribute('aria-label', 'Details for _ga')
    region.focus()
    await user.tab()
    expect(details).toHaveFocus()
    await user.click(details)

    expect(details.parentElement).toHaveAttribute('open')
    expect(screen.getByText('Google Analytics')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('keeps long cookie names and domains inside a labeled mobile scroll region', () => {
    const cookie = {
      ...validAuditReport.cookies[0],
      name: `very_long_cookie_${'name'.repeat(20)}`,
      domain: `.${'long-subdomain-'.repeat(12)}example.com`,
    }
    render(<CookieEvidence cookies={[cookie]} />)

    const region = screen.getByRole('region', { name: 'Cookie evidence table' })
    const table = screen.getByRole('table', {
      name: 'Cookies observed during this fresh visit',
    })

    expect(region).toHaveClass('overflow-x-auto')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(table).toHaveClass('min-w-[44rem]')
    expect(screen.getByText(cookie.name)).toHaveClass('break-all')
    expect(screen.getByText(cookie.domain)).toHaveClass('break-all')
  })
})
