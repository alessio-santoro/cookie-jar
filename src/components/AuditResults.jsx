import { formatDateTime, formatDuration } from '../shared/formatting.js'
import CookieEvidence from './CookieEvidence.jsx'

const OUTCOME_DETAILS = {
  FAIL: {
    heading: 'Configured cookie signatures matched',
    explanation: 'Observed cookies matched one or more configured Analytics or Marketing signatures during this visit.',
    color: 'text-red-800',
  },
  REVIEW: {
    heading: 'Observed cookies are unclassified',
    explanation: 'One or more observed cookies matched no configured signature.',
    color: 'text-amber-900',
  },
  PASS: {
    heading: 'No configured signatures matched',
    explanation: 'No observed cookie matched a configured signature. This is not evidence that other tracking does not exist.',
    color: 'text-teal-900',
  },
}

const CATEGORIES = [
  {
    key: 'essential',
    name: 'Essential',
    explanation: 'A heuristic association with basic site functions; the name alone does not prove the cookie is necessary.',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    explanation: 'A heuristic association with measuring visits and how a site is used.',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    explanation: 'A heuristic association with advertising and marketing activity.',
  },
  {
    key: 'unclassified',
    name: 'Unclassified',
    explanation: 'There is not enough signature information to identify the purpose; this is not proof of safe or malicious behavior.',
  },
]

function displayUrl(value) {
  const url = new URL(value)
  const hasQuery = Boolean(url.search)
  url.search = ''
  url.hash = ''
  return `${url.toString()}${hasQuery ? ' (query omitted)' : ''}`
}

export default function AuditResults({ report }) {
  const outcome = OUTCOME_DETAILS[report.outcome]
  const providers = [...new Set(
    report.cookies
      .map((cookie) => cookie.provider)
      .filter(Boolean),
  )].sort()

  return (
    <section
      role="region"
      aria-labelledby="audit-result-heading"
      aria-live="polite"
      className="mt-8 space-y-6"
    >
      <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Website check
        </p>
        <h2
          id="audit-result-heading"
          className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${outcome.color}`}
        >
          {outcome.heading}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-700">
          {outcome.explanation}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {report.summary.total} {report.summary.total === 1 ? 'cookie' : 'cookies'} observed in this visit.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map(({ key, name, explanation }) => (
            <div key={key} className="rounded-lg bg-sky-50 p-3">
              <dt className="text-sm font-semibold text-slate-900">{name}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
                {report.summary[key]}
              </dd>
              <p className="mt-2 text-sm leading-5 text-slate-700">{explanation}</p>
            </div>
          ))}
        </dl>

        {report.cookies.length === 0 && (
          <p className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
            No cookies were observed during this visit. This does not mean the site
            uses no other tracking.
          </p>
        )}

        {providers.length > 0 && (
          <p className="mt-5 text-sm leading-6 text-slate-700">
            Signature-associated providers: <span className="font-semibold">{providers.join(', ')}</span>.
            A name match is not proof that cookie data was transmitted.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h3 className="text-lg font-semibold text-slate-950">Visit details</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-slate-600">Requested address</dt>
            <dd className="mt-1 break-all text-sm text-slate-900">
              {displayUrl(report.requestedUrl)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-slate-600">Final address</dt>
            <dd className="mt-1 break-all text-sm text-slate-900">
              {displayUrl(report.finalUrl)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Captured</dt>
            <dd className="mt-1 text-sm text-slate-900">
              <time dateTime={report.capturedAt}>{formatDateTime(report.capturedAt)}</time>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Visit duration</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDuration(report.durationMs)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          The visit waited up to {formatDuration(report.observation.navigationTimeoutMs)}
          {' '}for page content, attempted network idle for up to{' '}
          {formatDuration(report.observation.networkIdleTimeoutMs)}, then observed
          for {formatDuration(report.observation.settleTimeMs)}.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
        <h3 className="text-lg font-semibold text-amber-950">Warnings</h3>
        {report.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950">
            {report.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-amber-950">
            No additional capture warnings were recorded.
          </p>
        )}
      </div>

      <CookieEvidence cookies={report.cookies} />

      <aside className="rounded-xl bg-slate-100 p-5 text-sm leading-6 text-slate-800 sm:p-7">
        <h3 className="font-semibold text-slate-950">What this result can and cannot tell you</h3>
        <p className="mt-2">
          This is one bounded, fresh visit to the exact submitted page, before
          any consent choice. It does not use your browser or interact with
          consent controls, and it does not crawl the domain or compare
          post-consent behavior.
        </p>
        <p className="mt-2">
          It does not cover other pages, later behavior, local storage,
          fingerprinting, cookieless tracking, or actual cookie reads or network
          transmissions.
        </p>
        <p className="mt-2">
          Cookie-name signatures are heuristic: they do not prove a cookie&apos;s
          actual intent, that data was transmitted, that a website is safe, or
          legal compliance. No known match does not mean no tracking exists.
        </p>
      </aside>
    </section>
  )
}

