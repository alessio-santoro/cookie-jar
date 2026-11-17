export const AUDIT_CATEGORIES = Object.freeze([
  'ESSENTIAL',
  'ANALYTICS',
  'MARKETING',
  'UNCLASSIFIED',
])

export const AUDIT_OUTCOMES = Object.freeze(['PASS', 'REVIEW', 'FAIL'])

const SAME_SITE_VALUES = new Set(['Strict', 'Lax', 'None'])
const REPORT_KEYS = [
  'requestedUrl',
  'finalUrl',
  'capturedAt',
  'durationMs',
  'outcome',
  'summary',
  'observation',
  'warnings',
  'cookies',
]
const SUMMARY_KEYS = [
  'total',
  'essential',
  'analytics',
  'marketing',
  'unclassified',
]
const OBSERVATION_KEYS = [
  'navigationTimeoutMs',
  'networkIdleTimeoutMs',
  'settleTimeMs',
]
const COOKIE_KEYS = [
  'name',
  'domain',
  'path',
  'category',
  'provider',
  'matchedSignature',
  'expiresAt',
  'secure',
  'httpOnly',
  'sameSite',
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key))
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isHttpUrl(value) {
  if (!isNonEmptyString(value)) return false

  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol)
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && !url.port
  } catch {
    return false
  }
}

function isUtcTimestamp(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return false
  }

  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return false

  const [wholeSeconds, fraction = ''] = value.slice(0, -1).split('.')
  const canonical = `${wholeSeconds}.${fraction.padEnd(3, '0')}Z`
  return new Date(milliseconds).toISOString() === canonical
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function isCookie(value) {
  return hasExactKeys(value, COOKIE_KEYS)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.domain)
    && isNonEmptyString(value.path)
    && AUDIT_CATEGORIES.includes(value.category)
    && (value.provider === null || isNonEmptyString(value.provider))
    && (value.matchedSignature === null || isNonEmptyString(value.matchedSignature))
    && (value.expiresAt === null || isUtcTimestamp(value.expiresAt))
    && typeof value.secure === 'boolean'
    && typeof value.httpOnly === 'boolean'
    && SAME_SITE_VALUES.has(value.sameSite)
}

function expectedOutcome(summary) {
  if (summary.analytics > 0 || summary.marketing > 0) return 'FAIL'
  if (summary.unclassified > 0) return 'REVIEW'
  return 'PASS'
}

export function isAuditRequest(value) {
  return hasExactKeys(value, ['url'])
    && typeof value.url === 'string'
    && value.url.length <= 2048
    && isHttpUrl(value.url)
}

export function isAuditError(value) {
  return hasExactKeys(value, ['code', 'message', 'requestId'])
    && typeof value.code === 'string'
    && /^[A-Z][A-Z0-9_]*$/.test(value.code)
    && isNonEmptyString(value.message)
    && typeof value.requestId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value.requestId)
}

export function isAuditReport(value) {
  if (!hasExactKeys(value, REPORT_KEYS)
    || !isHttpUrl(value.requestedUrl)
    || !isHttpUrl(value.finalUrl)
    || !isUtcTimestamp(value.capturedAt)
    || !isCount(value.durationMs)
    || !AUDIT_OUTCOMES.includes(value.outcome)
    || !hasExactKeys(value.summary, SUMMARY_KEYS)
    || !hasExactKeys(value.observation, OBSERVATION_KEYS)
    || !Array.isArray(value.warnings)
    || !value.warnings.every((warning) => typeof warning === 'string')
    || !Array.isArray(value.cookies)
    || !value.cookies.every(isCookie)) {
    return false
  }

  if (!SUMMARY_KEYS.every((key) => isCount(value.summary[key]))
    || !OBSERVATION_KEYS.every((key) => isCount(value.observation[key]))) {
    return false
  }

  const counts = {
    ESSENTIAL: 0,
    ANALYTICS: 0,
    MARKETING: 0,
    UNCLASSIFIED: 0,
  }
  for (const cookie of value.cookies) {
    counts[cookie.category] += 1
  }

  return value.summary.total === value.cookies.length
    && value.summary.essential === counts.ESSENTIAL
    && value.summary.analytics === counts.ANALYTICS
    && value.summary.marketing === counts.MARKETING
    && value.summary.unclassified === counts.UNCLASSIFIED
    && value.outcome === expectedOutcome(value.summary)
}
