import { execFileSync, spawnSync } from 'node:child_process'
import { chmod, lstat, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDestinationProxy } from './destination-proxy.js'

const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const BRIDGE_PATH = join(SERVER_DIRECTORY, 'browser-network-bridge.js')
const LAUNCHER_PATH = join(SERVER_DIRECTORY, 'browser-network-launcher.js')

export class BrowserNetworkBoundaryError extends Error {
  constructor() {
    super('Live website checks are unavailable because isolated networking is not ready.')
    this.name = 'BrowserNetworkBoundaryError'
    this.code = 'BROWSER_NETWORK_UNAVAILABLE'
    this.status = 503
  }
}

function commandPath(command) {
  try {
    return execFileSync('which', [command], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function assertLinuxRequirements() {
  if (process.platform !== 'linux') {
    throw new BrowserNetworkBoundaryError()
  }

  const unsharePath = commandPath('unshare')
  if (!unsharePath) {
    throw new BrowserNetworkBoundaryError()
  }

  const loopbackPath = commandPath('ip') ?? commandPath('busybox')
  if (!loopbackPath) {
    throw new BrowserNetworkBoundaryError()
  }

  const loopbackArgs = loopbackPath.endsWith('/busybox')
    ? ['ifconfig', 'lo', 'up']
    : ['link', 'set', 'lo', 'up']
  const probe = spawnSync(unsharePath, [
    '--user',
    '--map-root-user',
    '--net',
    '--',
    '/usr/bin/true',
  ], { encoding: 'utf8' })
  if (probe.error || probe.status !== 0) {
    throw new BrowserNetworkBoundaryError()
  }

  return { unsharePath, loopbackPath, loopbackArgs }
}

async function stopBridge(controlSocketPath) {
  try {
    await lstat(controlSocketPath)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  await new Promise((resolvePromise, reject) => {
    const socket = connect(controlSocketPath)
    socket.once('error', (error) => {
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
        resolvePromise()
      } else {
        reject(error)
      }
    })
    socket.once('connect', () => socket.end('STOP', resolvePromise))
  })
}

export async function createBrowserNetworkBoundary({
  chromiumPath,
  environment = {},
} = {}) {
  if (typeof chromiumPath !== 'string' || chromiumPath.length === 0) {
    throw new TypeError('chromiumPath must be a non-empty executable path.')
  }
  if (environment === null || typeof environment !== 'object'
    || Array.isArray(environment)) {
    throw new TypeError('environment must be an environment object.')
  }

  const { unsharePath, loopbackPath, loopbackArgs } = assertLinuxRequirements()
  const directory = await mkdtemp(join(tmpdir(), 'cookiejar-browser-network-'))
  const proxySocketPath = join(directory, 'egress.sock')
  const controlSocketPath = join(directory, 'bridge-control.sock')
  const wrapperPath = join(directory, 'chromium-isolated')
  const rejectedRequests = []
  let proxy

  try {
    proxy = await createDestinationProxy({
      socketPath: proxySocketPath,
      onRejected: (rejection) => rejectedRequests.push(rejection),
    })
    const script = [
      '#!/bin/sh',
      `exec ${shellQuote(unsharePath)} --user --map-root-user --net -- ${shellQuote(process.execPath)} ${shellQuote(LAUNCHER_PATH)} "$@"`,
      '',
    ].join('\n')
    await writeFile(wrapperPath, script, { mode: 0o700 })
    await chmod(wrapperPath, 0o700)

    return {
      executablePath: wrapperPath,
      environment: {
        ...environment,
        COOKIEJAR_BROWSER_PATH: resolve(chromiumPath),
        COOKIEJAR_BRIDGE_PATH: BRIDGE_PATH,
        COOKIEJAR_EGRESS_SOCKET: proxySocketPath,
        COOKIEJAR_BRIDGE_CONTROL: controlSocketPath,
        COOKIEJAR_LOOPBACK_TOOL: loopbackPath,
        COOKIEJAR_LOOPBACK_ARGS: JSON.stringify(loopbackArgs),
        COOKIEJAR_UNSHARE_PATH: unsharePath,
      },
      getRejectedRequests() {
        return [...rejectedRequests]
      },
      async close() {
        await stopBridge(controlSocketPath)
        await proxy.close()
        await rm(directory, { recursive: true, force: true })
      },
    }
  } catch (error) {
    await proxy?.close()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
