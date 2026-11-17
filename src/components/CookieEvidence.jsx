import { formatDateTime } from '../shared/formatting.js'

function formatCategory(category) {
  return category[0] + category.slice(1).toLowerCase()
}

function CookieDetails({ cookie }) {
  return (
    <details className="mt-2">
      <summary
        aria-label={`Details for ${cookie.name}`}
        className="w-fit cursor-pointer rounded text-sm font-semibold text-teal-900 underline decoration-teal-700 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        More details
      </summary>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-700">Provider association</dt>
          <dd className="break-all text-slate-900">
            {cookie.provider ?? 'Not identified by a known signature'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Path</dt>
          <dd className="break-all text-slate-900">{cookie.path}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Matched signature</dt>
          <dd className="break-all text-slate-900">
            {cookie.matchedSignature ?? 'No known signature'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Cookie settings</dt>
          <dd className="text-slate-900">
            {[
              cookie.secure && 'Secure',
              cookie.httpOnly && 'HTTP-only',
              `SameSite ${cookie.sameSite}`,
            ].filter(Boolean).join(', ')}
          </dd>
        </div>
      </dl>
      {cookie.provider && (
        <p className="mt-2 text-sm leading-5 text-slate-600">
          The provider is associated with a cookie-name signature; this does not
          prove that data was transmitted.
        </p>
      )}
    </details>
  )
}

function CookieExpiration({ expiresAt }) {
  if (expiresAt === null) {
    return (
      <div>
        <span className="font-medium text-slate-900">Session</span>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Lasts for a browser session; this is not a guaranteed deletion time.
        </p>
      </div>
    )
  }

  return (
    <time dateTime={expiresAt} className="text-sm text-slate-900">
      {formatDateTime(expiresAt)}
    </time>
  )
}

export default function CookieEvidence({ cookies }) {
  if (cookies.length === 0) return null

  return (
    <section
      aria-labelledby="cookie-evidence-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <h3 id="cookie-evidence-heading" className="text-lg font-semibold text-slate-950">
        Cookie evidence
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Domains show where each cookie is scoped. Scroll within the table on
        narrow screens; use each row&apos;s details to discover its path and provider association.
      </p>
      <div
        role="region"
        aria-label="Cookie evidence table"
        tabIndex={0}
        className="mt-4 overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        <table className="w-full min-w-[44rem] table-fixed border-collapse text-left">
          <caption className="sr-only">Cookies observed during this fresh visit</caption>
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[34%]" />
          </colgroup>
          <thead className="bg-sky-50 text-sm text-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Name</th>
              <th scope="col" className="p-3 font-semibold">Domain</th>
              <th scope="col" className="p-3 font-semibold">Category</th>
              <th scope="col" className="p-3 font-semibold">Expiration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cookies.map((cookie, index) => (
              <tr key={`${cookie.domain}\u0000${cookie.name}\u0000${cookie.path}\u0000${index}`}>
                <td className="break-all p-3 align-top text-sm font-semibold text-slate-950">
                  {cookie.name}
                  <CookieDetails cookie={cookie} />
                </td>
                <td className="break-all p-3 align-top text-sm text-slate-800">
                  {cookie.domain}
                </td>
                <td className="p-3 align-top text-sm text-slate-800">
                  {formatCategory(cookie.category)}
                </td>
                <td className="p-3 align-top">
                  <CookieExpiration expiresAt={cookie.expiresAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
