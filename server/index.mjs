import { createServer } from 'node:http'
import {
  embedToken,
  featuredApps,
  listConnections,
  revokeConnection,
  searchApps,
} from './viasocket.mjs'
import { digestStatus, sendDigest, startDigestScheduler } from './digest.mjs'
import { loadTasks, saveTasks } from './store.mjs'

/**
 * The app's only backend. It keeps the viaSocket signing secret off the
 * browser, mirrors the task list, and sends the midnight digest. Run with
 * `npm run dev:api`; Vite proxies /api here.
 */

const PORT = Number(process.env.PORT) || 8787
const MAX_BODY_BYTES = 5 * 1024 * 1024

/**
 * The app has no accounts yet, so there is one local user. This is the swap
 * point: once there is a session, return the signed-in user's stable id here.
 */
function currentUserId() {
  return process.env.VIASOCKET_USER_ID || 'local-user'
}

function send(res, status, body) {
  const isText = typeof body === 'string'
  res.writeHead(status, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(isText ? body : JSON.stringify(body))
}

async function readJsonBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Body is not valid JSON'), { status: 400 })
  }
}

const routes = [
  ['GET', /^\/api\/tasks$/, async () => ({ tasks: await loadTasks() })],

  ['PUT', /^\/api\/tasks$/, async (_url, _params, req) => {
    const tasks = await readJsonBody(req)
    if (!Array.isArray(tasks)) throw Object.assign(new Error('Expected an array of tasks'), { status: 400 })
    await saveTasks(tasks)
    return { ok: true }
  }],

  ['GET', /^\/api\/digest$/, () => digestStatus(currentUserId())],

  ['POST', /^\/api\/digest\/send$/, () => sendDigest(currentUserId())],

  ['GET', /^\/api\/integrations\/token$/, () => embedToken(currentUserId())],

  ['GET', /^\/api\/integrations\/apps$/, async (url) => {
    const query = (url.searchParams.get('q') || '').trim()
    return query ? searchApps(query) : featuredApps()
  }],

  ['GET', /^\/api\/integrations\/connections$/, () => listConnections(currentUserId())],

  ['DELETE', /^\/api\/integrations\/connections\/([^/]+)$/, async (_url, [authId]) => {
    await revokeConnection(currentUserId(), decodeURIComponent(authId))
    return { ok: true }
  }],
]

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  for (const [method, pattern, handler] of routes) {
    const match = url.pathname.match(pattern)
    if (!match || req.method !== method) continue
    try {
      send(res, 200, await handler(url, match.slice(1), req))
    } catch (error) {
      console.error(`${method} ${url.pathname}:`, error.message)
      send(res, error.status ?? 502, { error: error.message })
    }
    return
  }
  send(res, 404, { error: 'Not found' })
})

// Loopback only: with no accounts yet, anyone who can reach this acts as the local user.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`API on http://127.0.0.1:${PORT}`)
  startDigestScheduler(currentUserId())
})
