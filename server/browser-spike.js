import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'

async function browserParentRssBytes(pid) {
  if (process.platform !== 'linux') return null
  const status = await readFile(`/proc/${pid}/status`, 'utf8')
  const match = status.match(/^VmRSS:\s+(\d+) kB$/m)
  if (!match) throw new Error('Browser memory measurement unavailable')
  return Number(match[1]) * 1024
}

export async function runBrowserSpike() {
  const started = performance.now()
  const marker = randomUUID()
  const path = `/fixture-${marker}`
  const fixture = createServer((request, response) => {
    if (request.url !== path) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': `fixture_http=${marker}; HttpOnly; SameSite=Lax; Path=/`,
    })
    response.end(`<!doctype html><title>CookieJar controlled fixture</title>
      <script>document.cookie = "fixture_js=${marker}; SameSite=Lax; Path=/"</script>
      <button onclick="document.cookie='fixture_consent=accepted; Path=/'">Accept</button>`)
  })

  let browserServer
  let browser
  try {
    await new Promise((resolve, reject) => {
      fixture.once('error', reject)
      fixture.listen(0, '127.0.0.1', resolve)
    })
    const target = `http://127.0.0.1:${fixture.address().port}${path}`
    const executableStarted = performance.now()
    const executablePath = await chromium.executablePath()
    const executableReadyMs = performance.now() - executableStarted
    const launchStarted = performance.now()
    browserServer = await playwright.launchServer({
      executablePath,
      args: chromium.args,
      headless: true,
      timeout: 20000,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: '/tmp',
        TMPDIR: '/tmp',
        LANG: 'en_US.UTF-8',
        LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '',
      },
    })
    browser = await playwright.connect(browserServer.wsEndpoint())
    const browserStartupMs = performance.now() - launchStarted
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const initialCookieCount = (await context.cookies()).length
    await context.route('**/*', (route) =>
      route.request().url() === target ? route.continue() : route.abort())
    await context.routeWebSocket('**/*', (socket) => socket.close())
    const page = await context.newPage()
    const response = await page.goto(target, {
      waitUntil: 'load',
      timeout: 10000,
    })
    if (response?.status() !== 200) throw new Error('Fixture navigation failed')

    const captured = await context.cookies()
    const verified = initialCookieCount === 0
      && captured.length === 2
      && captured.every((cookie) => cookie.value === marker)
      && captured.some((cookie) => cookie.name === 'fixture_http' && cookie.httpOnly)
      && captured.some((cookie) => cookie.name === 'fixture_js' && !cookie.httpOnly)
    if (!verified) throw new Error('Controlled fixture cookie verification failed')

    const result = {
      scope: 'local-controlled-fixture-only',
      browserVersion: browser.version(),
      initialCookieCount,
      cookies: captured.map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expiresAt: cookie.expires === -1
          ? null : new Date(cookie.expires * 1000).toISOString(),
      })),
      executableReadyMs: Math.round(executableReadyMs),
      browserStartupMs: Math.round(browserStartupMs),
      nodeRssBytes: process.memoryUsage().rss,
      browserParentRssBytes: await browserParentRssBytes(browserServer.process().pid),
      browserSandboxDisabled: chromium.args.includes('--no-sandbox'),
    }
    await context.close()
    result.durationMs = Math.round(performance.now() - started)
    return result
  } finally {
    try {
      await browser?.close()
    } finally {
      try {
        await browserServer?.close()
      } finally {
        if (fixture.listening) {
          await new Promise((resolve, reject) => {
            fixture.close((error) => error ? reject(error) : resolve())
            fixture.closeAllConnections()
          })
        }
      }
    }
  }
}
