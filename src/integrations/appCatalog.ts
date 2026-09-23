import type { IntegrationApp } from '../types/integration'

const STORAGE_KEY = 'todo-app.integration-apps.v1'

/**
 * Remembers the name and icon of every app the user has seen, so the
 * Connected list can label a connection whose record carries only ids.
 * A cache only — losing it just means a connection shows its service id.
 */
function read(): Record<string, IntegrationApp> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, IntegrationApp>) : {}
  } catch {
    return {}
  }
}

export function rememberApps(apps: IntegrationApp[]) {
  if (apps.length === 0) return
  const catalog = read()
  for (const app of apps) catalog[app.serviceId] = app
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
  } catch {
    // Storage unavailable — labels fall back to service ids.
  }
}

export function lookupApp(serviceId: string | null): IntegrationApp | null {
  return serviceId ? (read()[serviceId] ?? null) : null
}
