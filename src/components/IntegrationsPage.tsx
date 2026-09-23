import { useCallback, useEffect, useRef, useState } from 'react'
import type { Connection, IntegrationApp } from '../types/integration'
import { disconnect, fetchEmbedToken, listConnections, searchApps } from '../integrations/api'
import { lookupApp, rememberApps } from '../integrations/appCatalog'
import { loadConnectScript, openConnection } from '../integrations/connect'
import { DailyDigestCard } from './DailyDigestCard'

const SEARCH_DEBOUNCE_MS = 250

/** The daily email sends through Gmail, so the card can connect it directly. */
const GMAIL: IntegrationApp = {
  serviceId: 'rowo0bqrhj5g',
  name: 'Gmail',
  description: '',
  iconUrl: 'https://stuff.thingsofbrand.com/gmail.com/images/imge_idrA5FDGTH_1763454052978.svg',
}

function AppIcon({ app, name }: { app: { iconUrl: string | null } | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (app?.iconUrl && !failed) {
    return <img className="app-icon" src={app.iconUrl} alt="" onError={() => setFailed(true)} />
  }
  return (
    <span className="app-icon app-icon--fallback" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function ConnectionRow({ connection, onDisconnect }: {
  connection: Connection
  onDisconnect: (authId: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const app = lookupApp(connection.serviceId)
  const name = connection.name ?? app?.name ?? connection.serviceId ?? 'Unknown app'
  const icon = connection.iconUrl ? { iconUrl: connection.iconUrl } : app

  return (
    <li className="app-row">
      <AppIcon app={icon} name={name} />
      <div className="app-row__body">
        <p className="app-row__name">{name}</p>
        {connection.expired ? (
          <p className="app-row__meta app-row__meta--warning">Expired — connect it again</p>
        ) : (
          connection.label && connection.label !== name && <p className="app-row__meta">{connection.label}</p>
        )}
      </div>
      {confirming ? (
        <div className="app-row__actions">
          <button className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            className="btn btn--danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onDisconnect(connection.authId)
              } finally {
                setBusy(false)
                setConfirming(false)
              }
            }}
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <button className="btn btn--ghost" onClick={() => setConfirming(true)}>
          Disconnect
        </button>
      )}
    </li>
  )
}

export function IntegrationsPage() {
  const [query, setQuery] = useState('')
  const [apps, setApps] = useState<IntegrationApp[]>([])
  const [searching, setSearching] = useState(true)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  // The popup has to open inside the click, so the token and script are readied ahead of it.
  const tokenRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  const prepareConnect = useCallback(async () => {
    try {
      const [token] = await Promise.all([fetchEmbedToken(), loadConnectScript()])
      tokenRef.current = token
      setReady(true)
    } catch (error) {
      setReady(false)
      setNotice({ tone: 'error', text: (error as Error).message })
    }
  }, [])

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await listConnections())
    } catch (error) {
      setConnections((current) => current ?? [])
      setNotice({ tone: 'error', text: `Could not load connections: ${(error as Error).message}` })
    }
  }, [])

  useEffect(() => {
    void prepareConnect()
    void refreshConnections()
  }, [prepareConnect, refreshConnections])

  useEffect(() => {
    const controller = new AbortController()
    setSearching(true)
    setSearchError(null)
    const timer = setTimeout(async () => {
      try {
        const results = await searchApps(query.trim(), controller.signal)
        rememberApps(results)
        setApps(results)
      } catch (error) {
        if (controller.signal.aborted) return
        setApps([])
        setSearchError((error as Error).message)
      }
      if (!controller.signal.aborted) setSearching(false)
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const connectedServiceIds = new Set(connections?.map((c) => c.serviceId).filter(Boolean))

  function handleConnect(app: IntegrationApp) {
    const token = tokenRef.current
    if (!token) return
    setNotice(null)
    setConnecting(app.serviceId)
    rememberApps([app])

    // Called synchronously from the click so the browser allows the popup.
    void openConnection(token, app.serviceId).then(async (result) => {
      setConnecting(null)
      if (result.status === 'success') {
        setNotice({ tone: 'success', text: `${app.name} connected.` })
        await refreshConnections()
      } else if (result.status === 'error') {
        setNotice({ tone: 'error', text: result.error?.message || `Could not connect ${app.name}.` })
      }
      // 'closed': the user backed out; nothing was created.
    })
  }

  async function handleDisconnect(authId: string) {
    setNotice(null)
    try {
      await disconnect(authId)
      setConnections((current) => current?.filter((c) => c.authId !== authId) ?? null)
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not disconnect: ${(error as Error).message}` })
    }
  }

  const trimmed = query.trim()

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Integrations</h1>
          <p className="main__subtitle">Connect the apps you work in.</p>
        </div>
      </header>

      {notice && (
        <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      <DailyDigestCard
        connectionsKey={connections?.map((c) => `${c.authId}:${c.expired}`).join(',') ?? ''}
        connectReady={ready && connecting === null}
        onConnectGmail={() => handleConnect(GMAIL)}
      />

      {connections && connections.length > 0 && (
        <section className="integrations__section">
          <h2 className="section-title">Connected</h2>
          <ul className="app-list">
            {connections.map((connection) => (
              <ConnectionRow key={connection.authId} connection={connection} onDisconnect={handleDisconnect} />
            ))}
          </ul>
        </section>
      )}

      <section className="integrations__section">
        <input
          className="search"
          type="search"
          placeholder="Search 2,000+ apps"
          aria-label="Search apps"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <h2 className="section-title">{trimmed ? `Results for “${trimmed}”` : 'Popular apps'}</h2>

        {searchError ? (
          <div className="empty">
            <p className="empty__title">Search is unavailable</p>
            <p className="empty__hint">{searchError}</p>
          </div>
        ) : searching && apps.length === 0 ? (
          <div className="empty">
            <p className="empty__hint">Loading apps…</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="empty">
            <p className="empty__title">No apps match “{trimmed}”</p>
            <p className="empty__hint">Try the app’s name, or a shorter search.</p>
          </div>
        ) : (
          <ul className={`app-list${searching ? ' app-list--stale' : ''}`}>
            {apps.map((app) => {
              const isConnected = connectedServiceIds.has(app.serviceId)
              return (
                <li key={app.serviceId} className="app-row">
                  <AppIcon app={app} name={app.name} />
                  <div className="app-row__body">
                    <p className="app-row__name">{app.name}</p>
                    {app.description && <p className="app-row__description">{app.description}</p>}
                  </div>
                  {isConnected && <span className="badge">Connected</span>}
                  <button
                    className={`btn ${isConnected ? 'btn--ghost' : 'btn--primary'}`}
                    disabled={!ready || connecting !== null}
                    onClick={() => handleConnect(app)}
                  >
                    {connecting === app.serviceId ? 'Connecting…' : isConnected ? 'Add account' : 'Connect'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
