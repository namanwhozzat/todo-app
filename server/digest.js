/**
 * Daily email of pending tasks, sent from the user's own Gmail through viaSocket.
 *
 * viaSocket has no clock trigger of its own, so the schedule lives here: this process wakes at
 * DIGEST_HOUR (server local time, default 9) and runs Gmail's "Send Email" action for every user
 * who turned the digest on. The server must be running at that hour; if it starts later the same
 * day, it catches up once.
 */
import { connectionStore } from './connectionStore.js'
import { jsonFile } from './jsonFile.js'
import { taskStore } from './taskStore.js'
import { viasocket } from './viasocket.js'

// From the Gmail app document (.claude/skills/viasocket-gmail/SKILL.md).
export const GMAIL = {
  serviceId: 'rowo0bqrhj5g',
  name: 'Gmail',
  iconUrl: 'https://stuff.thingsofbrand.com/gmail.com/images/imge_idrA5FDGTH_1763454052978.svg',
}
const SEND_EMAIL_VERSION_ID = 'rowwj0sfmhub'

const DIGEST_HOUR = Number(process.env.DIGEST_HOUR ?? 9)

/** { [userId]: { email, enabled, authId, scriptId, lastSentOn } } — scriptId is a credential. */
const file = jsonFile('digests.json', {})

class DigestError extends Error {}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function readAll() {
  return file.read()
}

async function patch(userId, changes) {
  const all = await readAll()
  all[userId] = { ...all[userId], ...changes }
  await file.write(all)
  return all[userId]
}

/** What the browser may see: never the scriptId. */
export async function digestStatus(userId) {
  const digest = (await readAll())[userId] ?? {}
  const gmail = await connectionStore.findByService(userId, GMAIL.serviceId)
  let suggestedEmail = null
  if (gmail && !digest.email) suggestedEmail = await gmailAddress(userId, gmail.authId).catch(() => null)
  return {
    enabled: digest.enabled === true,
    email: digest.email ?? '',
    suggestedEmail,
    lastSentOn: digest.lastSentOn ?? null,
    hour: DIGEST_HOUR,
    gmail: { ...GMAIL, connected: Boolean(gmail) },
  }
}

/** The user's own Gmail address, from the "from" field's options (their send-as addresses). */
async function gmailAddress(userId, authId) {
  const { options } = await viasocket
    .user(userId)
    .listOptions(SEND_EMAIL_VERSION_ID, { fieldKey: 'from', authId, existingFields: {} })
  return options[0]?.value ?? null
}

export async function updateDigest(userId, { enabled, email }) {
  const trimmed = typeof email === 'string' ? email.trim() : ''
  if (!enabled) return patch(userId, { enabled: false, email: trimmed || undefined })

  if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(trimmed)) throw new DigestError('Enter a valid email address')
  const gmail = await connectionStore.findByService(userId, GMAIL.serviceId)
  if (!gmail) throw new DigestError('Connect Gmail first')

  const current = (await readAll())[userId] ?? {}
  let scriptId = current.authId === gmail.authId ? current.scriptId : null
  if (!scriptId) {
    const user = viasocket.user(userId)
    scriptId = (await user.findEnabled(GMAIL.serviceId)) ?? (await user.enable(GMAIL.serviceId, gmail.authId)).scriptId
  }
  return patch(userId, { enabled: true, email: trimmed, authId: gmail.authId, scriptId })
}

/** Called when a connection is revoked: its script can no longer send. */
export async function forgetConnection(userId, authId) {
  const digest = (await readAll())[userId]
  if (digest?.authId !== authId) return
  if (digest.scriptId) await viasocket.user(userId).disableFlow(digest.scriptId).catch(() => {})
  await patch(userId, { enabled: false, authId: undefined, scriptId: undefined })
}

function buildEmail(tasks, now = new Date()) {
  const today = localDate(now)
  const pending = tasks.filter((t) => !t.completed)
  const groups = [
    { title: 'Overdue', tasks: [] },
    { title: 'Due today', tasks: [] },
    { title: 'Upcoming', tasks: [] },
    { title: 'No due date', tasks: [] },
  ]
  for (const task of pending) {
    if (!task.dueAt) groups[3].tasks.push(task)
    else {
      const day = localDate(new Date(task.dueAt))
      groups[day < today ? 0 : day === today ? 1 : 2].tasks.push(task)
    }
  }
  for (const group of groups) group.tasks.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))

  const dueLabel = (iso) =>
    new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const sections = groups
    .filter((g) => g.tasks.length > 0)
    .map(
      (g) => `
      <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:${g.title === 'Overdue' ? '#b3452f' : '#77776f'}">${g.title} (${g.tasks.length})</h3>
      <ul style="margin:0;padding-left:20px">${g.tasks
        .map(
          (t) => `<li style="margin:0 0 8px"><strong>${escapeHtml(t.title)}</strong>${
            t.dueAt ? ` <span style="color:#77776f">· ${escapeHtml(dueLabel(t.dueAt))}</span>` : ''
          }${t.description ? `<br><span style="color:#77776f">${escapeHtml(t.description)}</span>` : ''}</li>`,
        )
        .join('')}</ul>`,
    )
    .join('')

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return {
    count: pending.length,
    subject: `${pending.length} pending ${pending.length === 1 ? 'task' : 'tasks'} · ${dateLabel}`,
    messageBody: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1c1c1a;max-width:560px">
      <h2 style="margin:0 0 4px;font-size:20px">Your pending tasks</h2>
      <p style="margin:0;color:#77776f">${escapeHtml(dateLabel)}</p>${sections}</div>`,
  }
}

/** Sends one user's digest now. Returns the number of pending tasks mailed. */
export async function sendDigest(userId, { force = false } = {}) {
  const digest = (await readAll())[userId]
  if (!digest?.scriptId || !digest.email) throw new DigestError('Turn on the daily email first')

  const email = buildEmail(await taskStore.get(userId))
  if (email.count === 0 && !force) return 0

  await viasocket.runAction(digest.scriptId, SEND_EMAIL_VERSION_ID, {
    to: digest.email,
    subject: email.subject,
    messageBody: email.messageBody,
  })
  await patch(userId, { lastSentOn: localDate() })
  return email.count
}

async function sendDueDigests() {
  const today = localDate()
  for (const [userId, digest] of Object.entries(await readAll())) {
    if (!digest.enabled || digest.lastSentOn === today) continue
    try {
      const count = await sendDigest(userId)
      console.log(`Digest for ${userId}: ${count} pending tasks`)
    } catch (error) {
      console.error(`Digest for ${userId} failed:`, error.message)
    }
  }
}

export function startDigestScheduler() {
  const scheduleNext = () => {
    const next = new Date()
    next.setHours(DIGEST_HOUR, 0, 0, 0)
    if (next <= new Date()) next.setDate(next.getDate() + 1)
    setTimeout(() => {
      void sendDueDigests().finally(scheduleNext)
    }, next.getTime() - Date.now())
    console.log(`Next digest run: ${next.toLocaleString()}`)
  }
  // Started after today's run time: catch up once (lastSentOn prevents a second send).
  if (new Date().getHours() >= DIGEST_HOUR) void sendDueDigests()
  scheduleNext()
}

export { DigestError }
