import { AUDIT_CATEGORIES } from './audit-contract.js'

const SAME_SITE_VALUES = new Set(['Strict', 'Lax', 'None'])
const RULE_KEYS = ['type', 'signature', 'category', 'provider', 'rationale']

export const COOKIE_SIGNATURE_VERSION = 1

export const COOKIE_SIGNATURES = Object.freeze([
  Object.freeze({
    type: 'exact',
    signature: '_ga',
    category: 'ANALYTICS',
    provider: 'Google Analytics',
    rationale: 'Google Analytics uses _ga to distinguish users.',
  }),
  Object.freeze({
    type: 'prefix',
    signature: '_ga_',
    category: 'ANALYTICS',
    provider: 'Google Analytics',
    rationale: 'Google Analytics uses _ga_* cookies for additional identifiers.',
  }),
  Object.freeze({
    type: 'exact',
    signature: '_gid',
    category: 'ANALYTICS',
    provider: 'Google Analytics',
    rationale: 'Google Analytics uses _gid to distinguish users.',
  }),
  Object.freeze({
    type: 'exact',
    signature: '_fbp',
    category: 'MARKETING',
    provider: 'Meta Pixel',
    rationale: 'Meta Pixel uses _fbp for browser identification and advertising.',
  }),
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateRules(rules) {
  if (!Array.isArray(rules)) {
    throw new TypeError('Cookie signature rules must be an array.')
  }

  const seen = new Set()
  for (const rule of rules) {
    const keys = isRecord(rule) ? Object.keys(rule) : []
    if (keys.length !== RULE_KEYS.length
      || !RULE_KEYS.every((key) => Object.hasOwn(rule, key))
      || !['exact', 'prefix'].includes(rule.type)
      || typeof rule.signature !== 'string'
      || rule.signature.length === 0
      || !AUDIT_CATEGORIES.includes(rule.category)
      || rule.category === 'UNCLASSIFIED'
      || typeof rule.provider !== 'string'
      || rule.provider.trim().length === 0
      || typeof rule.rationale !== 'string'
      || rule.rationale.trim().length === 0) {
      throw new TypeError('Cookie signature rule is invalid.')
    }

    const key = `${rule.type}\u0000${rule.signature}`
    if (seen.has(key)) {
      throw new TypeError(`Duplicate ${rule.type} cookie signature: ${rule.signature}`)
    }
    seen.add(key)
  }
}

function findRule(name, rules) {
  const exact = rules.find((rule) => rule.type === 'exact' && rule.signature === name)
  if (exact) return exact

  return rules
    .filter((rule) => rule.type === 'prefix' && name.startsWith(rule.signature))
    .sort((left, right) => right.signature.length - left.signature.length)[0]
}

function validateBrowserCookie(cookie) {
  if (!isRecord(cookie)
    || typeof cookie.name !== 'string'
    || cookie.name.length === 0
    || typeof cookie.domain !== 'string'
    || cookie.domain.length === 0
    || typeof cookie.path !== 'string'
    || cookie.path.length === 0
    || typeof cookie.expires !== 'number'
    || !Number.isFinite(cookie.expires)
    || typeof cookie.secure !== 'boolean'
    || typeof cookie.httpOnly !== 'boolean'
    || !SAME_SITE_VALUES.has(cookie.sameSite)) {
    throw new TypeError('Browser cookie metadata is invalid.')
  }

  if (cookie.expires >= 0 && !Number.isFinite(new Date(cookie.expires * 1000).getTime())) {
    throw new TypeError('Browser cookie expiration is out of range.')
  }
}

function compareText(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function classifyCookies(browserCookies, rules = COOKIE_SIGNATURES) {
  if (!Array.isArray(browserCookies)) {
    throw new TypeError('Browser cookies must be an array.')
  }
  validateRules(rules)

  const cookies = browserCookies.map((cookie) => {
    validateBrowserCookie(cookie)
    const rule = findRule(cookie.name, rules)

    return {
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      category: rule?.category ?? 'UNCLASSIFIED',
      provider: rule?.provider ?? null,
      matchedSignature: rule?.signature ?? null,
      expiresAt: cookie.expires >= 0
        ? new Date(cookie.expires * 1000).toISOString()
        : null,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
    }
  }).sort((left, right) => compareText(left.domain, right.domain)
    || compareText(left.name, right.name)
    || compareText(left.path, right.path))

  const summary = {
    total: cookies.length,
    essential: 0,
    analytics: 0,
    marketing: 0,
    unclassified: 0,
  }
  for (const cookie of cookies) {
    summary[cookie.category.toLowerCase()] += 1
  }

  const outcome = summary.analytics > 0 || summary.marketing > 0
    ? 'FAIL'
    : summary.unclassified > 0
      ? 'REVIEW'
      : 'PASS'

  return { cookies, summary, outcome }
}
