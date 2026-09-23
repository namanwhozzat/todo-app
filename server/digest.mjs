import { listConnections, listOptions, runAction, scriptIdFor } from './viasocket.mjs'
import { loadDigestState, loadTasks, saveDigestState } from './store.mjs'

/**
 * Emails every pending task to the user at local midnight, through the Gmail
 * account they connected on the Integrations page. Ids come from the Gmail
 * document (flow.viasocket.com/documentation/rowo0bqrhj5g).
 */

const GMAIL_SERVICE_ID = 'rowo0bqrhj5g'
const SEND_EMAIL = 'rowwj0sfmhub'

/** 'YYYY-MM-DD' in the server's local timezone. */
function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function nextMidnight(now = new Date()) {
  const next = startOfDay(now)
  next.setDate(next.getDate() + 1)
  return next
}

/** The newest Gmail connection that still works, or null. */
async function gmailConnection(userId) {
  const connections = await listConnections(userId)
  const gmail = connections
    .filter((c) => c.serviceId === GMAIL_SERVICE_ID && !c.expired)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return gmail[0] ?? null
}

/** DIGEST_EMAIL if set, otherwise the connected Gmail account's own address. */
async function recipient(userId, connection) {
  if (process.env.DIGEST_EMAIL) return process.env.DIGEST_EMAIL
  if (connection.label?.includes('@')) return connection.label
  const [from] = await listOptions(userId, SEND_EMAIL, 'from', connection.authId)
  return from?.value ?? null
}

// ---------- email body ----------

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const dueFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Pending tasks in the groups the app itself uses, each sorted by due date. */
function groupPending(tasks, now) {
  const today = startOfDay(now).getTime()
  const groups = { Overdue: [], Today: [], Upcoming: [], 'No due date': [] }
  for (const task of tasks) {
    if (task.completed) continue
    if (!task.dueAt) groups['No due date'].push(task)
    else {
      const day = startOfDay(new Date(task.dueAt)).getTime()
      groups[day < today ? 'Overdue' : day === today ? 'Today' : 'Upcoming'].push(task)
    }
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => String(a.dueAt ?? a.createdAt).localeCompare(String(b.dueAt ?? b.createdAt)))
  }
  return groups
}

function renderEmail(groups, total, now) {
  const sections = Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([title, list]) => {
      const color = title === 'Overdue' ? '#b3452f' : '#1c1c1a'
      const items = list
        .map((task) => {
          const due = task.dueAt ? `<span style="color:#77776f"> · ${escapeHtml(dueFormatter.format(new Date(task.dueAt)))}</span>` : ''
          const description = task.description
            ? `<div style="color:#77776f;font-size:13px;margin-top:2px">${escapeHtml(task.description)}</div>`
            : ''
          return `<li style="margin:0 0 10px">${escapeHtml(task.title)}${due}${description}</li>`
        })
        .join('')
      return `<h3 style="margin:20px 0 8px;font-size:14px;color:${color}">${title} (${list.length})</h3><ul style="margin:0;padding-left:18px">${items}</ul>`
    })
    .join('')

  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#1c1c1a">
<p style="margin:0">You have <b>${total}</b> pending ${total === 1 ? 'task' : 'tasks'} going into ${escapeHtml(date)}.</p>
${sections}
</div>`
}

// ---------- sending ----------

/**
 * Sends the digest now. Returns what happened; never throws, so the scheduler
 * keeps running. The outcome is recorded for the Integrations page.
 */
export async function sendDigest(userId, now = new Date()) {
  const state = await loadDigestState()
  const record = (patch) => saveDigestState({ ...state, ...patch })

  try {
    const tasks = await loadTasks()
    if (tasks === null) throw new Error('No tasks have synced from the app yet. Open it once.')

    const groups = groupPending(tasks, now)
    const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0)
    if (total === 0) {
      await record({ lastSentOn: localDay(now), lastError: null })
      return { status: 'skipped', reason: 'No pending tasks.' }
    }

    const connection = await gmailConnection(userId)
    if (!connection) throw new Error('Connect Gmail on the Integrations page to receive the daily email.')

    const to = await recipient(userId, connection)
    if (!to) throw new Error('Could not work out which address to send to. Set DIGEST_EMAIL.')

    const scriptId = await scriptIdFor(userId, GMAIL_SERVICE_ID, connection.authId)
    await runAction(scriptId, SEND_EMAIL, {
      to,
      subject: `${total} pending ${total === 1 ? 'task' : 'tasks'} — ${localDay(now)}`,
      messageBody: renderEmail(groups, total, now),
    })

    await record({ lastSentOn: localDay(now), lastSentAt: now.toISOString(), lastError: null })
    return { status: 'sent', to, total }
  } catch (error) {
    await record({ lastError: error.message, lastErrorAt: now.toISOString() })
    console.error('Daily digest failed:', error.message)
    return { status: 'failed', error: error.message }
  }
}

export async function digestStatus(userId) {
  const [state, connection] = await Promise.all([
    loadDigestState(),
    gmailConnection(userId).catch(() => null),
  ])
  return {
    gmailConnected: connection !== null,
    to: connection ? await recipient(userId, connection).catch(() => null) : null,
    nextRunAt: nextMidnight().toISOString(),
    ...state,
  }
}

const RETRY_DELAY_MS = 30 * 60 * 1000
const MAX_RETRIES = 3

/**
 * Fires at every local midnight while the server is running, retrying a
 * failed send a few times. If the server was down at midnight, the missed
 * digest goes out when it next starts — but only once a digest has gone out
 * before, so the very first start does not send one out of the blue.
 */
export function startDigestScheduler(userId) {
  let timer = null

  const attempt = async (retriesLeft) => {
    const result = await sendDigest(userId)
    if (result.status === 'failed' && retriesLeft > 0) {
      timer = setTimeout(() => attempt(retriesLeft - 1), RETRY_DELAY_MS)
    } else {
      scheduleMidnight()
    }
  }

  const scheduleMidnight = () => {
    timer = setTimeout(() => attempt(MAX_RETRIES), nextMidnight().getTime() - Date.now())
  }

  void loadDigestState().then((state) => {
    if (state.lastSentOn && state.lastSentOn !== localDay()) void attempt(0)
    else scheduleMidnight()
  })

  return () => clearTimeout(timer)
}
