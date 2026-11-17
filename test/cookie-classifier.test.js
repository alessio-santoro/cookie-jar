import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyCookies,
  COOKIE_SIGNATURES,
} from '../src/shared/cookie-classifier.js'

function browserCookie(name, overrides = {}) {
  return {
    name,
    value: 'private-cookie-value',
    domain: 'example.com',
    path: '/',
    expires: -1,
    secure: false,
    httpOnly: false,
    sameSite: 'Lax',
    ...overrides,
  }
}

test('matches known exact and anchored-prefix tracking signatures', () => {
  const { cookies, summary, outcome } = classifyCookies([
    browserCookie('_ga'),
    browserCookie('_ga_ABC'),
    browserCookie('_gid'),
    browserCookie('_fbp'),
  ])

  assert.deepEqual(cookies.map(({ name, category, provider, matchedSignature }) => ({
    name,
    category,
    provider,
    matchedSignature,
  })), [
    { name: '_fbp', category: 'MARKETING', provider: 'Meta Pixel', matchedSignature: '_fbp' },
    { name: '_ga', category: 'ANALYTICS', provider: 'Google Analytics', matchedSignature: '_ga' },
    { name: '_ga_ABC', category: 'ANALYTICS', provider: 'Google Analytics', matchedSignature: '_ga_' },
    { name: '_gid', category: 'ANALYTICS', provider: 'Google Analytics', matchedSignature: '_gid' },
  ])
  assert.deepEqual(summary, {
    total: 4,
    essential: 0,
    analytics: 3,
    marketing: 1,
    unclassified: 0,
  })
  assert.equal(outcome, 'FAIL')
})

test('keeps unknown and near-miss names unclassified', () => {
  const names = ['custom_cookie', 'prefix_ga', '_gaFake', '_gid_extra']
  const { cookies, summary, outcome } = classifyCookies(
    names.map((name) => browserCookie(name)),
  )

  assert.ok(cookies.every((cookie) => (
    cookie.category === 'UNCLASSIFIED'
      && cookie.provider === null
      && cookie.matchedSignature === null
  )))
  assert.equal(summary.unclassified, names.length)
  assert.equal(outcome, 'REVIEW')
})

test('prefers exact rules over overlapping prefixes and supports justified Essential rules', () => {
  const rules = [
    {
      type: 'prefix',
      signature: 'fixture_',
      category: 'MARKETING',
      provider: 'Fixture',
      rationale: 'The test prefix intentionally overlaps one explicit fixture rule.',
    },
    {
      type: 'exact',
      signature: 'fixture_csrf',
      category: 'ESSENTIAL',
      provider: 'Fixture',
      rationale: 'The controlled fixture requires this token to validate its form submission.',
    },
  ]
  const { cookies, summary, outcome } = classifyCookies(
    [browserCookie('fixture_csrf')],
    rules,
  )

  assert.equal(cookies[0].category, 'ESSENTIAL')
  assert.equal(cookies[0].matchedSignature, 'fixture_csrf')
  assert.equal(summary.essential, 1)
  assert.equal(outcome, 'PASS')
  assert.equal(COOKIE_SIGNATURES.some((rule) => rule.category === 'ESSENTIAL'), false)
})

test('rejects duplicate rules that would make a signature ambiguous', () => {
  assert.throws(
    () => classifyCookies([], [...COOKIE_SIGNATURES, COOKIE_SIGNATURES[0]]),
    /Duplicate exact cookie signature: _ga/,
  )
})

test('sorts evidence by domain, name, then path and omits cookie values', () => {
  const input = [
    browserCookie('zeta', { domain: 'z.example', path: '/b' }),
    browserCookie('alpha', { domain: 'a.example', path: '/z' }),
    browserCookie('alpha', { domain: 'a.example', path: '/a' }),
    browserCookie('alpha', { domain: 'a.example', path: '/b', expires: 1790790000 }),
  ]
  const { cookies } = classifyCookies(input)

  assert.deepEqual(cookies.map(({ domain, name, path }) => [domain, name, path]), [
    ['a.example', 'alpha', '/a'],
    ['a.example', 'alpha', '/b'],
    ['a.example', 'alpha', '/z'],
    ['z.example', 'zeta', '/b'],
  ])
  assert.equal(cookies[0].expiresAt, null)
  assert.equal(cookies[1].expiresAt, new Date(1790790000 * 1000).toISOString())
  assert.equal(Object.hasOwn(cookies[0], 'value'), false)
})

test('returns PASS for an empty capture and REVIEW when only unknowns remain', () => {
  assert.deepEqual(classifyCookies([]), {
    cookies: [],
    summary: {
      total: 0,
      essential: 0,
      analytics: 0,
      marketing: 0,
      unclassified: 0,
    },
    outcome: 'PASS',
  })
  assert.equal(classifyCookies([browserCookie('unknown')]).outcome, 'REVIEW')
})

test('keeps FAIL precedence when known tracking and unknown cookies coexist', () => {
  const result = classifyCookies([
    browserCookie('unknown'),
    browserCookie('_fbp'),
  ])

  assert.equal(result.summary.unclassified, 1)
  assert.equal(result.summary.marketing, 1)
  assert.equal(result.outcome, 'FAIL')
})

test('rejects malformed browser cookie metadata instead of producing partial findings', () => {
  assert.throws(() => classifyCookies(null), /must be an array/)
  assert.throws(
    () => classifyCookies([browserCookie('_ga', { sameSite: 'Invalid' })]),
    /metadata is invalid/,
  )
})
