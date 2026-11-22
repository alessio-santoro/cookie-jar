import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AuditResults from '../../src/components/AuditResults.jsx'
import {
  sessionCookieReviewReport,
  validAuditReport,
} from '../fixtures/audit-contract.js'

const zeroCookieReport = {
  ...validAuditReport,
  outcome: 'PASS',
  summary: {
    total: 0,
    essential: 0,
    analytics: 0,
    marketing: 0,
    unclassified: 0,
  },
  warnings: ['Network idle was not reached during the bounded wait.'],
  cookies: [],
}

describe('audit result summary', () => {
  it('explains configured signature matches and associated providers', () => {
    render(<AuditResults report={validAuditReport} />)

    expect(screen.getByRole('heading', { name: 'Configured cookie signatures matched' }))
      .toBeInTheDocument()
    expect(screen.getAllByText(/Google Analytics/)).toHaveLength(2)
    expect(screen.getByText(/not proof that cookie data was transmitted/))
      .toBeInTheDocument()
    expect(screen.getAllByText('Analytics')).toHaveLength(1)
    expect(screen.getByText(/1 cookie observed in this visit/)).toBeInTheDocument()
  })

  it('uses the unclassified heading for unknown-only cookies and explains uncertainty', () => {
    render(<AuditResults report={sessionCookieReviewReport} />)

    expect(screen.getByRole('heading', { name: 'Observed cookies are unclassified' }))
      .toBeInTheDocument()
    expect(screen.getByText(/not enough signature information to identify the purpose/))
      .toBeInTheDocument()
    expect(screen.queryByText(/Signature-associated providers/)).not.toBeInTheDocument()
  })

  it('explains zero cookies, capture details, warnings, and scope limitations', () => {
    render(<AuditResults report={zeroCookieReport} />)

    expect(screen.getByRole('heading', { name: 'No configured signatures matched' }))
      .toBeInTheDocument()
    expect(screen.getByText(/No cookies were observed during this visit/))
      .toBeInTheDocument()
    expect(screen.getByText(/network idle was not reached/i)).toBeInTheDocument()
    expect(screen.getByText('Requested address')).toBeInTheDocument()
    expect(screen.getByText('Final address')).toBeInTheDocument()
    expect(screen.getByText('Captured')).toBeInTheDocument()
    expect(screen.getByText('Visit duration')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'TIME'))
      .toHaveAttribute('dateTime', validAuditReport.capturedAt)
    expect(screen.getByText(/5\.4 seconds/)).toBeInTheDocument()
    expect(screen.getByText(/20 seconds/)).toBeInTheDocument()
    expect(screen.getByText(/3 seconds/)).toBeInTheDocument()
    expect(screen.getByText(/2 seconds/)).toBeInTheDocument()
    expect(screen.getByText(/exact submitted page, before any consent choice/))
      .toBeInTheDocument()
    expect(screen.getByText(/does not crawl the domain or compare post-consent behavior/))
      .toBeInTheDocument()
    expect(screen.queryByText(/privacy score|100% safe/i)).not.toBeInTheDocument()
  })

  it('does not display URL query strings or fragments', () => {
    const report = {
      ...validAuditReport,
      requestedUrl: 'https://example.com/?token=secret#fragment',
      finalUrl: 'https://example.com/?token=secret#fragment',
    }
    render(<AuditResults report={report} />)

    expect(screen.getAllByText(/query omitted/)).toHaveLength(2)
    expect(screen.queryByText(/secret|fragment/)).not.toBeInTheDocument()
  })
})
