import { connect, createServer } from 'node:net'

const [proxySocketPath, controlSocketPath] = process.argv.slice(2)
if (!proxySocketPath || !controlSocketPath) {
  throw new TypeError('The browser network bridge requires its private sockets.')
}

const clients = new Set()
const proxyServer = createServer((client) => {
  clients.add(client)
  client.once('close', () => clients.delete(client))

  const upstream = connect(proxySocketPath)
  client.once('close', () => upstream.destroy())
  upstream.once('close', () => client.destroy())
  upstream.once('error', () => client.destroy())
  client.once('error', () => upstream.destroy())
  client.pipe(upstream)
  upstream.pipe(client)
})
const controlServer = createServer((socket) => {
  socket.once('data', (data) => {
    if (data.toString('utf8') !== 'STOP') return
    shutdown()
  })
})

async function listen(server, options) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options, resolve)
  })
}

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const client of clients) client.destroy()
  const proxyClosed = new Promise((resolve) => proxyServer.once('close', resolve))
  const controlClosed = new Promise((resolve) => controlServer.once('close', resolve))
  proxyServer.close()
  controlServer.close()
  await Promise.all([proxyClosed, controlClosed])
}

await Promise.all([
  listen(proxyServer, { host: '127.0.0.1', port: 0 }),
  listen(controlServer, controlSocketPath),
])
process.stdout.write(`${proxyServer.address().port}\n`)

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
