import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  isAuditError,
  isAuditReport,
  isAuditRequest,
} from '../src/shared/audit-contract.js'
import {
  sessionCookieReviewReport,
  validAuditError,
  validAuditReport,
  validAuditRequest,
} from './fixtures/audit-contract.js'

test('keeps the documented report example aligned with the shared fixture', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  const example = readme.match(
    /This example is the `validAuditReport` fixture[\s\S]*?```json\n([\s\S]*?)\n```/,
  )

  assert.ok(example, 'README should include the valid audit report example')
  assert.deepEqual(JSON.parse(example[1]), validAuditReport)
})

test('validates audit requests and rejects unsafe URL forms', () => {
  assert.equal(isAuditRequest(validAuditRequest), true)
  assert.equal(isAuditRequest({ url: '  https://example.com  ' }), true)

  for (const url of [
    '',
    'not a URL',
    'ftp://example.com',
    'https://user:password@example.com',
    'https://example.com:8443',
    `https://example.com/${'a'.repeat(2048)}`,
  ]) {
    assert.equal(isAuditRequest({ url }), false, url)
  }

  assert.equal(isAuditRequest({ ...validAuditRequest, extra: true }), false)
  assert.equal(isAuditRequest(null), false)
})

test('validates structured audit errors', () => {
  assert.equal(isAuditError(validAuditError), true)
  assert.equal(isAuditError({
    ...validAuditError,
    requestId: 'not-a-request-id',
  }), false)
  assert.equal(isAuditError({
    ...validAuditError,
    code: 'AuditTimeout',
  }), false)
  assert.equal(isAuditError({
    ...validAuditError,
    detail: 'unexpected',
  }), false)
})

test('validates report enums, fields, and session-cookie nullability', () => {
  assert.equal(isAuditReport(validAuditReport), true)
  assert.equal(isAuditReport(sessionCookieReviewReport), true)
  assert.equal(isAuditReport({
    ...validAuditReport,
    cookies: [],
    summary: {
      total: 0,
      essential: 0,
      analytics: 0,
      marketing: 0,
      unclassified: 0,
    },
    outcome: 'PASS',
  }), true)
})

test('rejects invalid report enums and non-array collections', () => {
  assert.equal(isAuditReport({
    ...validAuditReport,
    outcome: 'SAFE',
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    cookies: [{
      ...validAuditReport.cookies[0],
      category: 'TRACKING',
    }],
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    cookies: null,
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    warnings: null,
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    cookies: [{
      ...validAuditReport.cookies[0],
      sameSite: 'Invalid',
    }],
  }), false)
})

test('accepts UTC timestamps and rejects offsets or invalid calendar dates', () => {
  assert.equal(isAuditReport({
    ...validAuditReport,
    capturedAt: '2026-10-26T15:00:00.123Z',
  }), true)
  assert.equal(isAuditReport({
    ...validAuditReport,
    capturedAt: '2026-10-26T15:00:00+00:00',
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    capturedAt: '2026-02-31T15:00:00Z',
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    cookies: [{
      ...validAuditReport.cookies[0],
      expiresAt: '2027-01-01T00:00:00+00:00',
    }],
  }), false)
})

test('rejects inconsistent summary counts and outcomes', () => {
  assert.equal(isAuditReport({
    ...validAuditReport,
    summary: {
      ...validAuditReport.summary,
      total: 2,
    },
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    summary: {
      ...validAuditReport.summary,
      analytics: 0,
    },
  }), false)
  assert.equal(isAuditReport({
    ...validAuditReport,
    outcome: 'REVIEW',
  }), false)
})

test('rejects cookie values and other unrecognized report fields', () => {
  const reportWithCookieValue = structuredClone(validAuditReport)
  reportWithCookieValue.cookies[0].value = 'must-not-leak'
  assert.equal(isAuditReport(reportWithCookieValue), false)

  assert.equal(isAuditReport({
    ...validAuditReport,
    extra: 'unexpected',
  }), false)
})
