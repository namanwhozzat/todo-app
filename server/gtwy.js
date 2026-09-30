/**
 * AI analysis of a newly added task, run by a GTWY.ai agent. The pauthkey stays on the server.
 *
 * Create an agent at app.gtwy.ai, then set in .env:
 *   GTWY_PAUTHKEY=...   (Org settings → Auth key)
 *   GTWY_AGENT_ID=...   (the agent's id, shown in its Integration guide)
 *   GTWY_API_URL=...    (optional, defaults to https://api.gtwy.ai)
 */

const API_URL = (process.env.GTWY_API_URL ?? 'https://api.gtwy.ai').replace(/\/+$/, '')
const PRIORITIES = ['low', 'medium', 'high']
const MAX_SUBTASKS = 5

export class AnalysisError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function analysisConfigured() {
  return Boolean(process.env.GTWY_PAUTHKEY && process.env.GTWY_AGENT_ID)
}

function instructions(task) {
  return [
    'Analyze this to-do task and reply with only a JSON object, no prose or code fences:',
    '{"summary": string (one sentence), "priority": "low" | "medium" | "high",',
    ' "category": string (one or two words), "estimateMinutes": number,',
    ` "subtasks": string[] (at most ${MAX_SUBTASKS} concrete next steps, empty if trivial)}`,
    '',
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Title: ${task.title}`,
    `Description: ${task.description || '(none)'}`,
    `Due: ${task.dueAt ?? '(no due date)'}`,
  ].join('\n')
}

/** Agents sometimes wrap JSON in fences or add a sentence; take the outermost object. */
function parseContent(content) {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end <= start) throw new AnalysisError(502, 'AI reply was not JSON')
  let raw
  try {
    raw = JSON.parse(content.slice(start, end + 1))
  } catch {
    throw new AnalysisError(502, 'AI reply was not valid JSON')
  }
  const estimate = Number(raw.estimateMinutes)
  return {
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'medium',
    category: typeof raw.category === 'string' ? raw.category.trim() : '',
    estimateMinutes: Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null,
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, MAX_SUBTASKS)
      : [],
  }
}

export async function analyzeTask(userId, task) {
  if (!analysisConfigured()) throw new AnalysisError(503, 'AI analysis is not configured on the server')

  const response = await fetch(`${API_URL}/api/v2/model/chat/completion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', pauthkey: process.env.GTWY_PAUTHKEY },
    body: JSON.stringify({
      agent_id: process.env.GTWY_AGENT_ID,
      user: instructions(task),
      // One thread per task keeps analyses independent of each other.
      thread_id: `${userId}-${task.id}`.slice(0, 128),
      response_type: 'text',
      variables: { title: task.title, description: task.description, due_at: task.dueAt ?? '' },
    }),
    signal: AbortSignal.timeout(60_000),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success === false) {
    const detail = body?.error ?? body?.detail ?? body?.message ?? `status ${response.status}`
    console.error('GTWY:', response.status, detail)
    throw new AnalysisError(502, `GTWY: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  }

  const content = body?.response?.data?.content ?? body?.data?.content
  if (typeof content !== 'string') throw new AnalysisError(502, 'GTWY returned no content')
  return { ...parseContent(content), analyzedAt: new Date().toISOString() }
}
