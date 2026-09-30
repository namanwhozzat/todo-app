import { useEffect, useState } from 'react'
import { connect, loadConnectScript, ViaSocketConnectError } from 'viasocket-apps/browser'
import { integrationsApi, type AppSummary, type Connection } from '../integrations/api'
import { DailyDigest } from './DailyDigest'

const SEARCH_DEBOUNCE_MS = 300

export function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AppSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    integrationsApi.connections().then(setConnections, (e: Error) => setError(e.message))
    // Warm the connect script so the popup opens on the first click.
    loadConnectScript().catch(() => {})
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(() => {
      integrationsApi
        .search(term, controller.signal)
        .then((apps) => {
          setResults(apps)
          setSearching(false)
        })
        .catch((e: Error) => {
          if (e.name === 'AbortError') return
          setError(e.message)
          setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  async function handleConnect(app: AppSummary) {
    setError(null)
    setBusy(app.serviceId)
    try {
      const embedToken = await integrationsApi.token()
      const { authId } = await connect({ embedToken, serviceId: app.serviceId })
      const saved = await integrationsApi.saveConnection(app, authId)
      setConnections((list) => [...list.filter((c) => c.authId !== saved.authId), saved])
    } catch (e) {
      if (e instanceof ViaSocketConnectError && e.code === 'closed') return
      setError(e instanceof Error ? e.message : 'Could not connect')
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect(connection: Connection) {
    setError(null)
    setBusy(connection.authId)
    try {
      await integrationsApi.disconnect(connection.authId)
      setConnections((list) => list.filter((c) => c.authId !== connection.authId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect')
    } finally {
      setBusy(null)
    }
  }

  const connectedServices = new Set(connections.map((c) => c.serviceId))

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Integrations</h1>
          <p className="main__subtitle">Connect the apps you use with your tasks.</p>
        </div>
      </header>

      {error && (
        <p className="integrations__error" role="alert">
          {error}
        </p>
      )}

      <DailyDigest
        connections={connections}
        onConnect={handleConnect}
        connecting={busy !== null}
      />

      {connections.length > 0 && (
        <section className="integrations__section">
          <h2 className="integrations__heading">Connected</h2>
          <ul className="app-list">
            {connections.map((c) => (
              <li key={c.authId} className="app-row">
                <AppIcon name={c.name} iconUrl={c.iconUrl} />
                <div className="app-row__body">
                  <p className="app-row__name">{c.name}</p>
                  <p className="app-row__meta">
                    Connected {new Date(c.connectedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="btn btn--ghost app-row__danger"
                  disabled={busy === c.authId}
                  onClick={() => handleDisconnect(c)}
                >
                  {busy === c.authId ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="integrations__section">
        <h2 className="integrations__heading">Add an app</h2>
        <input
          className="integrations__search"
          type="search"
          placeholder="Search 2,300+ apps — Slack, Google Calendar, Notion…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search apps"
        />

        {query.trim() && !searching && results.length === 0 && (
          <div className="empty">
            <p className="empty__title">No apps match “{query.trim()}”</p>
          </div>
        )}

        {results.length > 0 && (
          <ul className="app-list">
            {results.map((app) => (
              <li key={app.serviceId} className="app-row">
                <AppIcon name={app.name} iconUrl={app.iconUrl} />
                <div className="app-row__body">
                  <p className="app-row__name">{app.name}</p>
                  <p className="app-row__meta app-row__description">{app.description}</p>
                </div>
                <button
                  className={`btn ${connectedServices.has(app.serviceId) ? 'btn--ghost' : 'btn--primary'}`}
                  disabled={busy === app.serviceId}
                  onClick={() => handleConnect(app)}
                >
                  {busy === app.serviceId
                    ? 'Connecting…'
                    : connectedServices.has(app.serviceId)
                      ? 'Add another'
                      : 'Connect'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function AppIcon({ name, iconUrl }: { name: string; iconUrl: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!iconUrl || failed) {
    return <span className="app-icon app-icon--fallback">{name.charAt(0).toUpperCase()}</span>
  }
  return <img className="app-icon" src={iconUrl} alt="" onError={() => setFailed(true)} />
}
