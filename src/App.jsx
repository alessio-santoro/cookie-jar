import { useEffect, useRef, useState } from 'react'
import { AuditClientError, requestAudit } from './shared/audit-client.js'
import { isAuditRequest } from './shared/audit-contract.js'
import AuditResults from './components/AuditResults.jsx'

const INVALID_URL_MESSAGE = 'Enter a public HTTP or HTTPS website address using its default port.'

export default function App() {
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [report, setReport] = useState(null)
  const activeRequest = useRef(null)
  const requestSequence = useRef(0)

  useEffect(() => () => {
    requestSequence.current += 1
    activeRequest.current?.abort()
  }, [])

  function handleUrlChange(event) {
    setUrl(event.target.value)
    setValidationError('')
    setRequestError('')
    setReport(null)

    if (activeRequest.current) {
      requestSequence.current += 1
      activeRequest.current.abort()
      activeRequest.current = null
      setPending(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (activeRequest.current) return

    setReport(null)
    setRequestError('')
    if (!isAuditRequest({ url })) {
      setValidationError(INVALID_URL_MESSAGE)
      return
    }

    setValidationError('')
    const requestId = ++requestSequence.current
    const controller = new AbortController()
    activeRequest.current = controller
    setPending(true)

    try {
      const result = await requestAudit(url, { signal: controller.signal })
      if (requestId === requestSequence.current) setReport(result)
    } catch (error) {
      if (requestId !== requestSequence.current || error?.name === 'AbortError') return
      setRequestError(error instanceof AuditClientError
        ? error.message
        : 'The website check could not be completed. Please try again.')
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null
        setPending(false)
      }
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-10 text-slate-950 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-teal-800">
            CookieJar
          </p>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Check a website before you choose.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-slate-700">
            Request a fresh visit to see which cookies appear before a consent
            choice. It does not use your browser, account, or browsing history.
          </p>
        </header>

        <section className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm sm:p-7">
          <form onSubmit={handleSubmit} aria-busy={pending}>
            <label htmlFor="website-address" className="block text-base font-semibold">
              Website address
            </label>
            <p id="website-address-help" className="mt-1 text-sm leading-6 text-slate-600">
              Avoid private or token-bearing links. Only submit a public address
              you are comfortable sending to CookieJar.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="website-address"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={handleUrlChange}
                aria-required="true"
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError
                  ? 'website-address-help website-address-error'
                  : 'website-address-help'}
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition motion-reduce:transition-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
              />
              <button
                type="submit"
                disabled={pending}
                className="min-h-12 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white transition motion-reduce:transition-none hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {pending ? 'Checking...' : 'Check website'}
              </button>
            </div>
            {validationError && (
              <p
                id="website-address-error"
                role="alert"
                className="mt-3 text-sm font-medium text-red-800"
              >
                {validationError}
              </p>
            )}
          </form>

          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            Live website checks are not enabled in this local build. Submitting
            will not visit the address until local safety protections are verified.
          </p>

          {pending && (
            <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-700">
              Sending your request to check this website...
            </p>
          )}
          {requestError && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-800">
              {requestError} You can edit the address and try again.
            </p>
          )}
        </section>
        {report && <AuditResults report={report} />}
      </div>
    </main>
  )
}
