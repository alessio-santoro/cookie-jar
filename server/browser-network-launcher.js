import { spawn, spawnSync } from 'node:child_process'
import { fstatSync } from 'node:fs'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { connect } from 'node:net'

const {
  COOKIEJAR_BROWSER_PATH: browserPath,
  COOKIEJAR_BRIDGE_PATH: bridgePath,
  COOKIEJAR_EGRESS_SOCKET: proxySocketPath,
  COOKIEJAR_BRIDGE_CONTROL: controlSocketPath,
  COOKIEJAR_LOOPBACK_TOOL: loopbackTool,
  COOKIEJAR_LOOPBACK_ARGS: loopbackArgsText,
  COOKIEJAR_UNSHARE_PATH: unsharePath,
} = process.env

if (!browserPath || !bridgePath || !proxySocketPath
  || !controlSocketPath || !loopbackTool || !loopbackArgsText || !unsharePath) {
  throw new Error('The isolated browser launch configuration is incomplete.')
}

let loopbackArgs
try {
  loopbackArgs = JSON.parse(loopbackArgsText)
} catch {
  throw new Error('The isolated browser loopback configuration is invalid.')
}
if (!Array.isArray(loopbackArgs)
  || !loopbackArgs.every((argument) => typeof argument === 'string')) {
  throw new Error('The isolated browser loopback configuration is invalid.')
}

const loopback = spawnSync(loopbackTool, loopbackArgs, {
  encoding: 'utf8',
})
if (loopback.error || loopback.status !== 0) {
  throw new Error('Could not enable loopback inside the isolated browser network.')
}

const bridge = spawn(process.execPath, [
  bridgePath,
  proxySocketPath,
  controlSocketPath,
], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
const lines = createInterface({ input: bridge.stdout })
const bridgeReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Browser proxy bridge timed out.')), 5000)
  lines.once('line', (line) => {
    clearTimeout(timer)
    const port = Number(line)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      reject(new Error('Browser proxy bridge returned an invalid port.'))
      return
    }
    resolve(port)
  })
  bridge.once('error', (error) => {
    clearTimeout(timer)
    reject(error)
  })
  bridge.once('exit', (code) => {
    clearTimeout(timer)
    reject(new Error(`Browser proxy bridge exited before readiness (${code}).`))
  })
})

let browser
let shuttingDown = false
async function stopBridge() {
  if (!bridge || bridge.exitCode !== null) return
  const socket = connect(controlSocketPath)
  const stopped = new Promise((resolve) => {
    socket.once('error', () => resolve())
    socket.once('connect', () => socket.end('STOP', resolve))
  })
  await Promise.race([
    Promise.all([stopped, once(bridge, 'exit')]),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ])
  if (bridge.exitCode === null) bridge.kill('SIGTERM')
}

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  browser?.kill(signal)
  await stopBridge()
}

process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })

try {
  const proxyPort = await bridgeReady
  const args = process.argv.slice(2).filter((argument) => (
    !argument.startsWith('--proxy-server=')
    && !argument.startsWith('--proxy-bypass-list=')
    && argument !== '--no-sandbox'
    && argument !== '--disable-setuid-sandbox'
    && argument !== '--no-zygote'
  ))
  args.push(
    `--proxy-server=http://127.0.0.1:${proxyPort}`,
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
  )

  const stdio = [0, 1, 2]
  for (let descriptor = 3; descriptor < 16; descriptor += 1) {
    try {
      fstatSync(descriptor)
      stdio[descriptor] = descriptor
    } catch {
      stdio[descriptor] = 'ignore'
    }
  }

  browser = spawn(unsharePath, [
    '--user',
    '--map-user',
    '1000',
    '--',
    browserPath,
    ...args,
  ], { stdio })
  const [code, signal] = await once(browser, 'exit')
  await stopBridge()
  process.exitCode = code ?? (signal ? 1 : 0)
} catch (error) {
  await stopBridge()
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
