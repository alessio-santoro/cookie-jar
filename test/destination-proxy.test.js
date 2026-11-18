import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { connect as connectTcp } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createDestinationProxy } from '../server/destination-proxy.js'

const PUBLIC_TEST_ADDRESS = '93.184.216.34'

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cookiejar-proxy-test-'))
  const requests = []
  const originSockets = new Set()
  const origin = createServer((request, response) => {
    requests.push(request.url)
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: 'http://site.test/next' }).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      Connection: 'close',
    }).end('fixture response')
  })
  origin.on('upgrade', (request, socket) => {
    requests.push(request.url)
    socket.end(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Connection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
    )
  })
  origin.on('connection', (socket) => {
    originSockets.add(socket)
    socket.once('close', () => originSockets.delete(socket))
  })
  await new Promise((resolve) => origin.listen(0, '127.0.0.1', resolve))

  const connections = []
  const proxy = await createDestinationProxy({
    socketPath: join(directory, 'proxy.sock'),
    resolveHost: async (hostname) => {
      assert.equal(hostname, 'site.test')
      return [{ address: PUBLIC_TEST_ADDRESS, family: 4 }]
    },
    connect: ({ host, port }) => {
      connections.push({ host, port })
      return connectTcp({
        host: '127.0.0.1',
        port: origin.address().port,
      })
    },
  })

  return {
    directory,
    origin,
    proxy,
    requests,
    connections,
    async close() {
      await this.proxy.close()
      await new Promise((resolve) => {
        origin.close(() => resolve())
        origin.closeAllConnections()
        for (const socket of originSockets) socket.destroy()
      })
      await rm(directory, { recursive: true, force: true })
    },
  }
}

function proxyRequest(socketPath, requestText, { waitForHeader = false } = {}) {
  return new Promise((resolve, reject) => {
    const socket = connectTcp(socketPath)
    const chunks = []
    let settled = false
    socket.once('error', reject)
    socket.on('data', (chunk) => {
      chunks.push(chunk)
      const response = Buffer.concat(chunks).toString('latin1')
      if (waitForHeader && response.includes('\r\n\r\n') && !settled) {
        settled = true
        resolve({ response, socket })
      }
    })
    socket.once('end', () => {
      if (!settled) {
        settled = true
        resolve({ response: Buffer.concat(chunks).toString('latin1'), socket })
      }
    })
    socket.once('close', () => {
      if (!settled) {
        settled = true
        resolve({ response: Buffer.concat(chunks).toString('latin1'), socket })
      }
    })
    socket.write(requestText)
  })
}

test('proxies HTTP requests only to a validated, pinned public address', async () => {
  const fixture = await createFixture()
  try {
    const { response } = await proxyRequest(
      join(fixture.directory, 'proxy.sock'),
      'GET http://site.test/capture?x=1 HTTP/1.1\r\n'
        + 'Host: site.test\r\nConnection: close\r\n\r\n',
    )
    assert.match(response, /^HTTP\/1\.1 200/)
    assert.match(response, /fixture response/)
    assert.deepEqual(fixture.connections, [{
      host: PUBLIC_TEST_ADDRESS,
      port: 80,
    }])
    assert.deepEqual(fixture.requests, ['/capture?x=1'])
  } finally {
    await fixture.close()
  }
})

test('revalidates redirect and subresource destinations against fresh DNS answers', async () => {
  const fixture = await createFixture()
  let resolution = 0
  await fixture.proxy.close()
  fixture.proxy = await createDestinationProxy({
    socketPath: join(fixture.directory, 'proxy.sock'),
    resolveHost: async () => {
      resolution += 1
      return [{
        address: resolution === 1 ? PUBLIC_TEST_ADDRESS : '10.0.0.1',
        family: 4,
      }]
    },
    connect: ({ host, port }) => {
      fixture.connections.push({ host, port })
      return connectTcp({
        host: '127.0.0.1',
        port: fixture.origin.address().port,
      })
    },
  })

  try {
    const first = await proxyRequest(
      join(fixture.directory, 'proxy.sock'),
      'GET http://site.test/redirect HTTP/1.1\r\n'
        + 'Host: site.test\r\nConnection: close\r\n\r\n',
    )
    assert.match(first.response, /^HTTP\/1\.1 302/)

    const second = await proxyRequest(
      join(fixture.directory, 'proxy.sock'),
      'GET http://site.test/next HTTP/1.1\r\n'
        + 'Host: site.test\r\nConnection: close\r\n\r\n',
    )
    assert.match(second.response, /^HTTP\/1\.1 403/)
    assert.match(second.response, /UNSAFE_TARGET/)
    assert.equal(resolution, 2)
    assert.deepEqual(fixture.connections, [{
      host: PUBLIC_TEST_ADDRESS,
      port: 80,
    }])
    assert.deepEqual(fixture.requests, ['/redirect'])
  } finally {
    await fixture.close()
  }
})

test('applies the same policy to WebSocket upgrades and HTTPS CONNECT tunnels', async () => {
  const fixture = await createFixture()
  try {
    const websocket = await proxyRequest(
      join(fixture.directory, 'proxy.sock'),
      'GET ws://site.test/socket HTTP/1.1\r\n'
        + 'Host: site.test\r\n'
        + 'Connection: Upgrade\r\n'
        + 'Upgrade: websocket\r\n\r\n',
      { waitForHeader: true },
    )
    assert.match(websocket.response, /^HTTP\/1\.1 101/)
    websocket.socket.destroy()

    const tunnel = await proxyRequest(
      join(fixture.directory, 'proxy.sock'),
      'CONNECT site.test:443 HTTP/1.1\r\nHost: site.test:443\r\n\r\n',
      { waitForHeader: true },
    )
    assert.match(tunnel.response, /^HTTP\/1\.1 200 Connection Established/)
    tunnel.socket.destroy()
    assert.deepEqual(fixture.connections, [
      { host: PUBLIC_TEST_ADDRESS, port: 80 },
      { host: PUBLIC_TEST_ADDRESS, port: 443 },
    ])
    assert.deepEqual(fixture.requests, ['/socket'])
  } finally {
    await fixture.close()
  }
})

test('rejects private DNS answers and non-default ports before connecting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cookiejar-proxy-reject-'))
  const connects = []
  const proxy = await createDestinationProxy({
    socketPath: join(directory, 'proxy.sock'),
    resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
    connect: (options) => {
      connects.push(options)
      throw new Error('must not connect')
    },
  })

  try {
    const unsafe = await proxyRequest(
      join(directory, 'proxy.sock'),
      'GET http://site.test/ HTTP/1.1\r\nHost: site.test\r\n\r\n',
    )
    assert.match(unsafe.response, /^HTTP\/1\.1 403/)
    assert.match(unsafe.response, /UNSAFE_TARGET/)

    const subresource = await proxyRequest(
      join(directory, 'proxy.sock'),
      'GET http://tracker.test/pixel.gif HTTP/1.1\r\n'
        + 'Host: tracker.test\r\nConnection: close\r\n\r\n',
    )
    assert.match(subresource.response, /^HTTP\/1\.1 403/)
    assert.match(subresource.response, /UNSAFE_TARGET/)

    const nonDefaultPort = await proxyRequest(
      join(directory, 'proxy.sock'),
      'GET http://site.test:8080/ HTTP/1.1\r\nHost: site.test:8080\r\n\r\n',
    )
    assert.match(nonDefaultPort.response, /^HTTP\/1\.1 400/)
    assert.match(nonDefaultPort.response, /INVALID_TARGET/)
    assert.deepEqual(connects, [])
  } finally {
    await proxy.close()
    await rm(directory, { recursive: true, force: true })
  }
})
