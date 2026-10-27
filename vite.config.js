import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import audit from './api/audit.js'

function registerLocalApi(server) {
  server.middlewares.use((request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname

    if (pathname === '/api/audit') {
      audit(request, response)
      return
    }

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    next()
  })
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cookiejar-local-api',
      configureServer: registerLocalApi,
      configurePreviewServer: registerLocalApi,
    },
  ],
})
