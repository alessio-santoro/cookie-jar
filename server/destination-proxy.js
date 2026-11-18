import { chmod } from 'node:fs/promises'
import {
  Agent,
  createServer as createHttpServer,
  request as createHttpRequest,
} from 'node:http'
import { connect as connectTcp } from 'node:net'
import { resolvePublicTarget } from './destination-policy.js'

const STATUS_TEXT = {
  400: 'Bad Request',
  403: 'Forbidden',
  502: 'Bad Gateway',
}

function responseText(response, status, code) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'close',
  })
  response.end(code)
}

function socketResponse(socket, status, code) {
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_TEXT[status]}\r\n`
    + 'Content-Type: text/plain; charset=utf-8\r\n'
    + 'Cache-Control: no-store\r\n'
    + 'Connection: close\r\n'
    + `Content-Length: ${Buffer.byteLength(code)}\r\n\r\n${code}`,
  )
}

function proxyTarget(value, { websocket = false } = {}) {
  let target
  try {
    target = new URL(value)
  } catch {
    return null
  }

  if (websocket && target.protocol === 'ws:') target.protocol = 'http:'
  if (websocket && target.protocol === 'wss:') target.protocol = 'https:'
  if (!['http:', 'https:'].includes(target.protocol)) return null

  try {
    return new URL(target.toString())
  } catch {
    return null
  }
}

function requestHeaders(request, target, { websocket = false } = {}) {
  const headers = { ...request.headers }
  const connectionHeaders = String(headers.connection ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())

  for (const header of [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    ...connectionHeaders,
  ]) {
    delete headers[header]
  }

  headers.host = target.host
  if (websocket) {
    headers.connection = 'Upgrade'
    headers.upgrade = request.headers.upgrade
  } else {
    headers.connection = 'close'
  }
  return headers
}

function writeUpgradeRequest(request, target, socket, head) {
  const headers = requestHeaders(request, target, { websocket: true })
  const path = `${target.pathname}${target.search}`
  const lines = [`${request.method} ${path} HTTP/${request.httpVersion}`]
  for (const [name, value] of Object.entries(headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) lines.push(`${name}: ${item}`)
    }
  }
  socket.write(`${lines.join('\r\n')}\r\n\r\n`)
  if (head.length > 0) socket.write(head)
}

async function resolvedDestination(value, options, { websocket = false } = {}) {
  const target = proxyTarget(value, { websocket })
  if (!target) return null

  const scheme = target.protocol
  const expectedPort = scheme === 'https:' ? '443' : '80'
  if (target.port && target.port !== expectedPort) return null
  const { address } = await resolvePublicTarget(target.toString(), options)
  return {
    address,
    port: Number(expectedPort),
    target,
  }
}

function createProxyHandler({ resolveHost, connect, onRejected }) {
  const options = { resolveHost }
  const reject = (value, code, { websocket = false } = {}) => {
    onRejected?.({
      origin: proxyTarget(value, { websocket })?.origin ?? null,
      code,
    })
  }

  return {
    async request(request, response) {
      let destination
      try {
        destination = await resolvedDestination(request.url, options)
      } catch (error) {
        reject(request.url, error.code ?? 'UNSAFE_TARGET')
        responseText(
          response,
          error.code === 'INVALID_TARGET' ? 400 : 403,
          error.code ?? 'UNSAFE_TARGET',
        )
        return
      }

      if (!destination || destination.target.protocol !== 'http:') {
        reject(request.url, 'INVALID_TARGET')
        responseText(response, 400, 'INVALID_TARGET')
        return
      }

      const { address, port, target } = destination
      const upstream = createHttpServerRequest(request, response, {
        address,
        port,
        target,
        connect,
      })
      request.pipe(upstream)
    },

    async connect(request, client, head) {
      let destination
      try {
        if (/[/?#@]/.test(request.url)) {
          socketResponse(client, 400, 'INVALID_TARGET')
          return
        }
        destination = await resolvedDestination(`https://${request.url}`, options)
      } catch (error) {
        reject(`https://${request.url}`, error.code ?? 'UNSAFE_TARGET')
        socketResponse(
          client,
          error.code === 'INVALID_TARGET' ? 400 : 403,
          error.code ?? 'UNSAFE_TARGET',
        )
        return
      }

      if (!destination) {
        reject(`https://${request.url}`, 'INVALID_TARGET')
        socketResponse(client, 400, 'INVALID_TARGET')
        return
      }

      const upstream = connect({
        host: destination.address,
        port: destination.port,
      })
      client.once('close', () => upstream.destroy())
      upstream.once('close', () => client.destroy())
      upstream.once('error', () => {
        socketResponse(client, 502, 'DESTINATION_UNAVAILABLE')
      })
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length > 0) upstream.write(head)
        client.pipe(upstream)
        upstream.pipe(client)
      })
    },

    async upgrade(request, client, head) {
      let destination
      try {
        destination = await resolvedDestination(request.url, options, {
          websocket: true,
        })
      } catch (error) {
        reject(request.url, error.code ?? 'UNSAFE_TARGET', { websocket: true })
        socketResponse(
          client,
          error.code === 'INVALID_TARGET' ? 400 : 403,
          error.code ?? 'UNSAFE_TARGET',
        )
        return
      }

      if (!destination || destination.target.protocol !== 'http:') {
        reject(request.url, 'INVALID_TARGET', { websocket: true })
        socketResponse(client, 400, 'INVALID_TARGET')
        return
      }

      const upstream = connect({
        host: destination.address,
        port: destination.port,
      })
      client.once('close', () => upstream.destroy())
      upstream.once('close', () => client.destroy())
      upstream.once('error', () => {
        socketResponse(client, 502, 'DESTINATION_UNAVAILABLE')
      })
      upstream.once('connect', () => {
        writeUpgradeRequest(request, destination.target, upstream, head)
        client.pipe(upstream)
        upstream.pipe(client)
      })
    },
  }
}

function createHttpServerRequest(request, response, {
  address,
  port,
  target,
  connect,
}) {
  const agent = new Agent({ keepAlive: false })
  agent.createConnection = () => connect({ host: address, port })
  const upstream = createHttpRequest({
    host: address,
    port,
    method: request.method,
    path: `${target.pathname}${target.search}`,
    headers: requestHeaders(request, target),
    agent,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  response.once('close', () => {
    if (!response.writableFinished) upstream.destroy()
  })

  upstream.once('error', () => {
    agent.destroy()
    if (!response.headersSent) {
      responseText(response, 502, 'DESTINATION_UNAVAILABLE')
    } else {
      response.destroy()
    }
  })
  upstream.once('close', () => agent.destroy())
  return upstream
}

export async function createDestinationProxy({
  socketPath,
  resolveHost,
  connect = connectTcp,
  onRejected,
}) {
  if (typeof socketPath !== 'string' || socketPath.length === 0) {
    throw new TypeError('socketPath must be a non-empty path.')
  }
  if (resolveHost !== undefined && typeof resolveHost !== 'function') {
    throw new TypeError('resolveHost must be a function.')
  }
  if (typeof connect !== 'function') {
    throw new TypeError('connect must be a function.')
  }
  if (onRejected !== undefined && typeof onRejected !== 'function') {
    throw new TypeError('onRejected must be a function.')
  }

  const sockets = new Set()
  const outboundSockets = new Set()
  const rejectedRequests = []
  const reportRejection = (rejection) => {
    rejectedRequests.push(rejection)
    onRejected?.(rejection)
  }
  const trackedConnect = (options) => {
    const socket = connect(options)
    outboundSockets.add(socket)
    socket.once('close', () => outboundSockets.delete(socket))
    return socket
  }
  const trackedHandler = createProxyHandler({
    resolveHost,
    connect: trackedConnect,
    onRejected: reportRejection,
  })
  const server = createHttpServer()
  server.on('request', trackedHandler.request)
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.on('connect', trackedHandler.connect)
  server.on('upgrade', trackedHandler.upgrade)

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, resolve)
  })
  await chmod(socketPath, 0o600)

  return {
    getRejectedRequests() {
      return [...rejectedRequests]
    },
    async close() {
      if (!server.listening) return
      for (const socket of sockets) socket.destroy()
      for (const socket of outboundSockets) socket.destroy()
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    },
  }
}
