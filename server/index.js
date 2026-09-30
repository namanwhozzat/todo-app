/**
 * Integrations API and daily task digest. Holds the viaSocket signing secret, which must never
 * reach the browser.
 *
 *   npm run dev:api   # :8787, proxied by Vite under /api
 *
 * The end user is identified by the `x-user-id` header — a stable id the browser generates once.
 * Swap `userIdFrom()` for your session lookup when the app gets real accounts.
 */
import { createServer } from 'node:http'
import { ViaSocketError } from 'viasocket-apps'
import { connectionStore } from './connectionStore.js'
import { AnalysisError, analyzeTask } from './gtwy.js'
import { DigestError, digestStatus, forgetConnection, sendDigest, startDigestScheduler, updateDigest } from './digest.js'
import { taskStore } from './taskStore.js'
import { viasocket } from './viasocket.js'

const PORT = Number(process.env.PORT ?? 8787)
const SEARCH_URL = 'https://flow.sokt.io/func/scri12BSufQM'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function userIdFrom(req) {
  const id = req.headers['x-user-id']
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    throw new HttpError(401, 'Missing or invalid user id')
  }
  return id
}

async function readJson(req, limit = 10_000) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > limit) throw new HttpError(413, 'Body too large')
  }
  try {
    return JSON.parse(body || '{}')
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

function send(res, status, data) {
  if (typeof data === 'string') {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(data)
  } else if (data === undefined) {
    res.writeHead(status)
    res.end()
  } else {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(data))
  }
}

async function searchApps(term) {
  if (!term) return []
  const url = `${SEARCH_URL}?key=${encodeURIComponent(term)}`
  const response = await fetch(url)
  if (!response.ok) throw new HttpError(502, `App search failed (${response.status})`)
  const { data } = await response.json()
  if (!Array.isArray(data)) return []
  return data.map((app) => ({
    serviceId: app.service_id,
    name: app.name,
    iconUrl: app.iconurl ?? null,
    description: app.description ?? '',
  }))
}

async function route(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '')

  // Browser gets a signed token for the connect popup — never the secret.
  if (req.method === 'GET' && path === '/api/integrations/token') {
    return send(res, 200, await viasocket.user(userIdFrom(req)).token())
  }

  if (req.method === 'GET' && path === '/api/integrations/search') {
    userIdFrom(req)
    return send(res, 200, await searchApps(url.searchParams.get('q')?.trim() ?? ''))
  }

  if (req.method === 'GET' && path === '/api/integrations') {
    return send(res, 200, await connectionStore.list(userIdFrom(req)))
  }

  if (req.method === 'POST' && path === '/api/integrations/connected') {
    const userId = userIdFrom(req)
    const { serviceId, authId, name, iconUrl } = await readJson(req)
    if (typeof serviceId !== 'string' || typeof authId !== 'string' || !serviceId || !authId) {
      throw new HttpError(400, 'serviceId and authId are required')
    }
    const record = await connectionStore.add({
      userId,
      serviceId,
      authId,
      name: typeof name === 'string' ? name : serviceId,
      iconUrl: typeof iconUrl === 'string' ? iconUrl : null,
    })
    return send(res, 201, record)
  }

  const revoke = path.match(/^\/api\/integrations\/([^/]+)$/)
  if (req.method === 'DELETE' && revoke) {
    const userId = userIdFrom(req)
    const authId = decodeURIComponent(revoke[1])
    if (!(await connectionStore.find(userId, authId))) throw new HttpError(404, 'Connection not found')
    await forgetConnection(userId, authId)
    await viasocket.user(userId).revokeConnection(authId)
    await connectionStore.remove(userId, authId)
    return send(res, 204)
  }

  // The browser pushes its tasks here on every change so the digest can read them.
  if (req.method === 'PUT' && path === '/api/tasks') {
    const userId = userIdFrom(req)
    const tasks = await readJson(req, 2_000_000)
    if (!Array.isArray(tasks)) throw new HttpError(400, 'Expected an array of tasks')
    await taskStore.replace(userId, tasks)
    return send(res, 204)
  }

  // Runs the GTWY agent on one task; the browser stores the result on the task.
  if (req.method === 'POST' && path === '/api/tasks/analyze') {
    const userId = userIdFrom(req)
    const { id, title, description, dueAt } = await readJson(req)
    if (typeof id !== 'string' || typeof title !== 'string' || !title.trim()) {
      throw new HttpError(400, 'id and title are required')
    }
    const analysis = await analyzeTask(userId, {
      id,
      title: title.slice(0, 500),
      description: typeof description === 'string' ? description.slice(0, 4000) : '',
      dueAt: typeof dueAt === 'string' ? dueAt : null,
    })
    return send(res, 200, analysis)
  }

  if (req.method === 'GET' && path === '/api/digest') {
    return send(res, 200, await digestStatus(userIdFrom(req)))
  }

  if (req.method === 'PUT' && path === '/api/digest') {
    const userId = userIdFrom(req)
    const { enabled, email } = await readJson(req)
    await updateDigest(userId, { enabled: enabled === true, email })
    return send(res, 200, await digestStatus(userId))
  }

  if (req.method === 'POST' && path === '/api/digest/test') {
    const count = await sendDigest(userIdFrom(req), { force: true })
    return send(res, 200, { sent: true, count })
  }

  throw new HttpError(404, 'Not found')
}

createServer(async (req, res) => {
  try {
    await route(req, res)
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { error: error.message })
    if (error instanceof AnalysisError) return send(res, error.status, { error: error.message })
    if (error instanceof DigestError) return send(res, 400, { error: error.message })
    if (error instanceof ViaSocketError) {
      console.error('viaSocket:', error.status, error.message)
      return send(res, 502, { error: `viaSocket: ${error.message}` })
    }
    console.error(error)
    send(res, 500, { error: 'Internal error' })
  }
}).listen(PORT, () => {
  console.log(`Integrations API on http://localhost:${PORT}`)
  startDigestScheduler()
})
