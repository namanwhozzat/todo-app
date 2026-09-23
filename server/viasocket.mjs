import { createHmac } from 'node:crypto'

/**
 * viaSocket Apps API client. Server-side only: it signs embed tokens with
 * VIASOCKET_EMBED_SECRET, which must never reach the browser.
 */

const API = process.env.VIASOCKET_API_URL || 'https://flow-api.viasocket.com'
const RUN = process.env.VIASOCKET_RUN_URL || 'https://flow.sokt.io'
const SEARCH_URL = 'https://flow.sokt.io/func/scri12BSufQM'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. See .env.example.`)
  return value
}

const base64url = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/**
 * An HS256 embed token for one end user. `uniqueIdentifier` is this product's
 * stable id for that user — every connection is isolated by it, so it must
 * never change for an existing user.
 */
export function embedToken(uniqueIdentifier) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64url({
    org_id: required('VIASOCKET_ORG_ID'),
    project_id: required('VIASOCKET_PROJECT_ID'),
    unique_identifier: uniqueIdentifier,
    iat: Math.floor(Date.now() / 1000),
  })
  const signature = createHmac('sha256', required('VIASOCKET_EMBED_SECRET'))
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

async function call(path, uniqueIdentifier, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: embedToken(uniqueIdentifier) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `viaSocket ${path} failed with ${response.status}`)
  }
  return payload.data
}

/** @typedef {{ serviceId: string, name: string, description: string, iconUrl: string | null }} App */

/** @returns {App} */
function toApp(raw) {
  return {
    serviceId: raw.service_id,
    name: String(raw.name ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    iconUrl: raw.iconurl || null,
  }
}

/**
 * Lower is better. The catalog also matches descriptions and returns them in
 * no useful order, so "google sh" would list BigQuery above Sheets.
 */
function nameRank(name, query) {
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  const words = n.split(/[^a-z0-9]+/)
  if (q.split(/\s+/).every((part) => words.some((word) => word.startsWith(part)))) return 2
  if (n.includes(q)) return 3
  return 4
}

/** Searches the viaSocket catalog, best name matches first. */
export async function searchApps(query) {
  const url = `${SEARCH_URL}?key=${encodeURIComponent(query)}`
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `App search failed with ${response.status}`)
  }
  return (payload.data || [])
    .filter((raw) => raw.service_id)
    .map(toApp)
    .map((app, index) => ({ app, index, rank: nameRank(app.name, query) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ app }) => app)
}

/** Shown before the user types anything; the search endpoint returns nothing for an empty query. */
const FEATURED_NAMES = [
  'Gmail',
  'Google Calendar',
  'Slack',
  'Google Sheets',
  'Notion',
  'Google Task',
  'Trello',
  'GitHub',
  'Microsoft Teams',
  'Discord',
  'Asana',
  'Todoist',
]

let featuredCache = null

export async function featuredApps() {
  if (featuredCache) return featuredCache
  const results = await Promise.all(
    FEATURED_NAMES.map(async (name) => {
      const apps = await searchApps(name).catch(() => [])
      return apps.find((app) => app.name.toLowerCase() === name.toLowerCase()) ?? null
    }),
  )
  const apps = results.filter(Boolean)
  if (apps.length > 0) featuredCache = apps
  return apps
}

/** `connection_label` is a JSON string such as `{"Email":"a@b.com"}`; show its first value. */
function connectionLabel(raw) {
  try {
    const parsed = JSON.parse(raw)
    const value = parsed && typeof parsed === 'object' ? Object.values(parsed)[0] : parsed
    return value ? String(value) : null
  } catch {
    return raw ? String(raw) : null
  }
}

/** Every app this user has connected. An auth_id ends in `_<service_id>`. */
export async function listConnections(uniqueIdentifier) {
  const data = await call('/embed/authentications', uniqueIdentifier)
  return (Array.isArray(data) ? data : []).map((raw) => {
    const authId = String(raw.id ?? '')
    return {
      authId,
      serviceId: raw.service_id ?? (authId.includes('_') ? authId.split('_').pop() : null),
      name: raw.service_name ?? null,
      iconUrl: raw.iconUrl ?? null,
      label: connectionLabel(raw.connection_label),
      expired: raw.isExpired === true,
      updatedAt: raw.updated_at ?? null,
    }
  }).filter((connection) => connection.authId)
}

/** Every flow this user has: one per enabled app, one per trigger subscription. */
export async function listFlows(uniqueIdentifier) {
  const data = await call(
    `/projects/${required('VIASOCKET_PROJECT_ID')}/integrations`,
    uniqueIdentifier,
  )
  return data?.flows || []
}

/**
 * The script_id that runs this app's actions for this user, enabling the app
 * once if needed. Looked up every time rather than stored, so there is no
 * second copy of the credential to leak.
 */
export async function scriptIdFor(uniqueIdentifier, serviceId, authId) {
  const flows = await listFlows(uniqueIdentifier)
  const existing = flows.find(
    (flow) => flow.service_id === serviceId && flow.auth_id === authId && flow.status === 'active',
  )
  if (existing) return existing.id
  const data = await call(`/embed/enable/${serviceId}/${authId}`, uniqueIdentifier, { method: 'POST' })
  return data.script_id
}

/** The `{ label, value }` choices for one action field, as the connected account sees them. */
export async function listOptions(uniqueIdentifier, actionVersionId, fieldKey, authId, existingFields = {}) {
  const data = await call(`/embed/list-options/${actionVersionId}`, uniqueIdentifier, {
    method: 'POST',
    body: { fieldKey, auth_id: authId, existingFields },
  })
  return Array.isArray(data) ? data : (data?.data ?? [])
}

/** Runs one action. No embed token: the script_id is the credential. */
export async function runAction(scriptId, actionVersionId, inputData) {
  const response = await fetch(`${RUN}/func/${scriptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_version_id: actionVersionId, inputData }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!payload.success) throw new Error(payload.message || `Action failed with ${response.status}`)
  return payload.data
}

/** Disconnects an app, first turning off any flow built on it so none is left broken. */
export async function revokeConnection(uniqueIdentifier, authId) {
  const flows = (await listFlows(uniqueIdentifier)).filter(
    (flow) => flow.auth_id === authId && flow.status === 'active',
  )
  for (const flow of flows) {
    await call(`/embed/updatestatus/${flow.id}?status=0`, uniqueIdentifier, { method: 'PUT' })
  }
  await call(`/embed/authentications/revoke/${encodeURIComponent(authId)}`, uniqueIdentifier, {
    method: 'DELETE',
  })
}
