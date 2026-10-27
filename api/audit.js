import { randomUUID } from 'node:crypto'

export default function audit(request, response) {
  const isPost = request.method === 'POST'

  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')

  if (!isPost) {
    response.setHeader('Allow', 'POST')
  }

  response.statusCode = isPost ? 503 : 405
  response.end(JSON.stringify({
    code: isPost ? 'AUDIT_UNAVAILABLE' : 'METHOD_NOT_ALLOWED',
    message: isPost
      ? 'Website checks are not available yet.'
      : 'Use POST to request a website check.',
    requestId: randomUUID(),
  }))
}
