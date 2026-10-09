import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const port = Number(process.env.PORT || 4173)
createServer(async (request, response) => {
  if (!['/', '/index.html'].includes(new URL(request.url, 'http://localhost').pathname)) {
    response.writeHead(404).end('Not found')
    return
  }
  try {
    const html = await readFile(new URL('../dist/index.html', import.meta.url))
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
  } catch {
    response.writeHead(500).end('Run npm run build first')
  }
}).listen(port, '127.0.0.1', () => console.log(`Local URL: http://127.0.0.1:${port}`))
