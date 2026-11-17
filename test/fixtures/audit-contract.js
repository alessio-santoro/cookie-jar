export const validAuditRequest = {
  url: 'https://example.com',
}

export const validAuditReport = {
  requestedUrl: 'https://example.com/',
  finalUrl: 'https://example.com/',
  capturedAt: '2026-10-26T15:00:00Z',
  durationMs: 5420,
  outcome: 'FAIL',
  summary: {
    total: 1,
    essential: 0,
    analytics: 1,
    marketing: 0,
    unclassified: 0,
  },
  observation: {
    navigationTimeoutMs: 20000,
    networkIdleTimeoutMs: 3000,
    settleTimeMs: 2000,
  },
  warnings: [],
  cookies: [{
    name: '_ga',
    domain: '.example.com',
    path: '/',
    category: 'ANALYTICS',
    provider: 'Google Analytics',
    matchedSignature: '_ga',
    expiresAt: null,
    secure: true,
    httpOnly: false,
    sameSite: 'Lax',
  }],
}

export const sessionCookieReviewReport = {
  ...validAuditReport,
  outcome: 'REVIEW',
  summary: {
    total: 1,
    essential: 0,
    analytics: 0,
    marketing: 0,
    unclassified: 1,
  },
  cookies: [{
    name: 'custom_cookie',
    domain: '.example.com',
    path: '/',
    category: 'UNCLASSIFIED',
    provider: null,
    matchedSignature: null,
    expiresAt: null,
    secure: false,
    httpOnly: false,
    sameSite: 'Lax',
  }],
}

export const validAuditError = {
  code: 'AUDIT_TIMEOUT',
  message: 'The website check took too long.',
  requestId: '4a39157a-2f76-4b2f-b9d0-943604690301',
}
