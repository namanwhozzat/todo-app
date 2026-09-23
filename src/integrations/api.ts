import type { Connection, IntegrationApp } from '../types/integration'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${response.status})`)
  }
  return (response.headers.get('Content-Type') ?? '').includes('application/json')
    ? response.json()
    : (response.text() as Promise<T>)
}

/** Featured apps when `query` is empty, otherwise catalog matches. */
export function searchApps(query: string, signal?: AbortSignal) {
  return request<IntegrationApp[]>(`/api/integrations/apps?q=${encodeURIComponent(query)}`, { signal })
}

export function listConnections() {
  return request<Connection[]>('/api/integrations/connections')
}

export function disconnect(authId: string) {
  return request<{ ok: true }>(`/api/integrations/connections/${encodeURIComponent(authId)}`, {
    method: 'DELETE',
  })
}

/** An embed token for the connect popup, signed by the backend. */
export function fetchEmbedToken() {
  return request<string>('/api/integrations/token')
}

export interface DigestStatus {
  gmailConnected: boolean
  to: string | null
  nextRunAt: string
  lastSentOn: string | null
  lastSentAt: string | null
  lastError: string | null
}

export type DigestResult =
  | { status: 'sent'; to: string; total: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

export function fetchDigestStatus() {
  return request<DigestStatus>('/api/digest')
}

export function sendDigestNow() {
  return request<DigestResult>('/api/digest/send', { method: 'POST' })
}
