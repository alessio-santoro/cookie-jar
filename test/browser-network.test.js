import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'
import { createBrowserNetworkBoundary } from '../server/browser-network.js'

test('launches packaged Chromium within the isolated network boundary', {
  skip: process.platform !== 'linux',
}, async (context) => {
  let boundary
  let browser
  try {
    try {
      boundary = await createBrowserNetworkBoundary({
        chromiumPath: await chromium.executablePath(),
        environment: {
          PATH: process.env.PATH ?? '',
          HOME: '/tmp',
          TMPDIR: '/tmp',
          LANG: 'en_US.UTF-8',
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '',
        },
      })
    } catch (error) {
      context.skip(error.message)
      return
    }

    try {
      browser = await playwright.launch({
        executablePath: boundary.executablePath,
        args: chromium.args,
        env: boundary.environment,
        headless: true,
      })
    } catch (error) {
      if (/Chromium sandboxing failed|No usable sandbox/.test(error.message)) {
        context.skip('The host does not permit Chromium sandbox namespaces.')
        return
      }
      throw error
    }
    assert.match(await browser.version(), /^\d+\.\d+\.\d+\.\d+$/)
    const commandLine = await browser.newBrowserCDPSession()
    const { arguments: browserArguments } = await commandLine.send(
      'Browser.getBrowserCommandLine',
    )
    assert.equal(browserArguments.includes('--no-sandbox'), false)
    await commandLine.detach()
  } finally {
    await browser?.close()
    await boundary?.close()
  }
})

test('isolates Chromium to loopback and forces public requests through policy proxy', {
  skip: process.platform !== 'linux',
}, async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'cookiejar-network-test-'))
  const fakeChromium = join(directory, 'fake-chromium')
  await writeFile(fakeChromium, String.raw`#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { connect } from 'node:net'

assert.notEqual(process.getuid(), 0)
const externalInterfaces = Object.keys(networkInterfaces())
  .filter((name) => name !== 'lo')
const routes = readFileSync('/proc/net/route', 'utf8')
  .trim().split('\n').slice(1).filter(Boolean)
const proxyArgument = process.argv.find((argument) =>
  argument.startsWith('--proxy-server=http://127.0.0.1:'))
assert.deepEqual(externalInterfaces, [])
assert.deepEqual(routes, [])
assert.ok(proxyArgument)
const port = Number(proxyArgument.split(':').at(-1))
const socket = connect(port, '127.0.0.1')
let response = ''
socket.setEncoding('latin1')
socket.on('connect', () => {
  socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n')
})
socket.on('data', (data) => { response += data })
socket.on('end', () => {
  assert.match(response, /^HTTP\/1\.1 403/)
  assert.match(response, /UNSAFE_TARGET/)
  process.stdout.write('NETWORK_BOUNDARY_OK\n')
})
`)
  await chmod(fakeChromium, 0o700)

  let boundary
  try {
    try {
      boundary = await createBrowserNetworkBoundary({
        chromiumPath: fakeChromium,
        environment: { PATH: process.env.PATH ?? '' },
      })
    } catch (error) {
      context.skip(error.message)
      return
    }

    const child = spawn(boundary.executablePath, [], {
      env: boundary.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data })
    child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data })
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    const [code] = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (status, signal) => resolve([status, signal]))
    })
    clearTimeout(timer)

    assert.equal(code, 0, stderr)
    assert.match(stdout, /NETWORK_BOUNDARY_OK/)
  } finally {
    await boundary?.close()
    await rm(directory, { recursive: true, force: true })
  }
})
