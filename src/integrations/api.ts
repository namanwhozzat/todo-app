import { createId } from '../lib/id'
import type { Task, TaskAnalysis } from '../types/task'

export interface AppSummary {
  serviceId: string
  name: string
  iconUrl: string | null
  description: string
}

export interface Connection {
  serviceId: string
  authId: string
  name: string
  iconUrl: string | null
  connectedAt: string
}

export interface DigestStatus {
  enabled: boolean
  email: string
  /** The connected Gmail address, offered when no email is set yet. */
  suggestedEmail: string | null
  lastSentOn: string | null
  hour: number
  gmail: { serviceId: string; name: string; iconUrl: string; connected: boolean }
}

const USER_KEY = 'todo-app.user-id.v1'
let memoryUserId: string | null = null

/**
 * A stable id for this browser, which viaSocket uses to keep each user's connections apart.
 * Replace with the signed-in user's id once the app has accounts.
 */
function userId(): string {
  try {
    let id = localStorage.getItem(USER_KEY)
    if (!id) {
      id = createId().replace(/[^A-Za-z0-9_-]/g, '')
      localStorage.setItem(USER_KEY, id)
    }
    return id
  } catch {
    memoryUserId ??= createId().replace(/[^A-Za-z0-9_-]/g, '')
    return memoryUserId
  }
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, 'x-user-id': userId() },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${response.status})`)
  }
  return response
}

export const integrationsApi = {
  async search(term: string, signal?: AbortSignal): Promise<AppSummary[]> {
    const response = await request(`/api/integrations/search?q=${encodeURIComponent(term)}`, { signal })
    return response.json()
  },

  async connections(): Promise<Connection[]> {
    return (await request('/api/integrations')).json()
  },

  async token(): Promise<string> {
    return (await request('/api/integrations/token')).text()
  },

  async saveConnection(app: AppSummary, authId: string): Promise<Connection> {
    const response = await request('/api/integrations/connected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: app.serviceId, authId, name: app.name, iconUrl: app.iconUrl }),
    })
    return response.json()
  },

  async disconnect(authId: string): Promise<void> {
    await request(`/api/integrations/${encodeURIComponent(authId)}`, { method: 'DELETE' })
  },
}

export const digestApi = {
  async status(): Promise<DigestStatus> {
    return (await request('/api/digest')).json()
  },

  async update(settings: { enabled: boolean; email: string }): Promise<DigestStatus> {
    const response = await request('/api/digest', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    return response.json()
  },

  async sendTest(): Promise<{ count: number }> {
    return (await request('/api/digest/test', { method: 'POST' })).json()
  },
}

export const aiApi = {
  async analyze(task: Pick<Task, 'id' | 'title' | 'description' | 'dueAt'>): Promise<TaskAnalysis> {
    const response = await request('/api/tasks/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, title: task.title, description: task.description, dueAt: task.dueAt }),
    })
    return response.json()
  },
}
