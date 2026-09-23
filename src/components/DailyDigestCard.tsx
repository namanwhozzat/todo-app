import { useEffect, useState } from 'react'
import { fetchDigestStatus, sendDigestNow, type DigestStatus } from '../integrations/api'

const whenFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

interface Props {
  /** Changes whenever the connection list does, so the card re-reads Gmail's state. */
  connectionsKey: string
  connectReady: boolean
  onConnectGmail: () => void
}

export function DailyDigestCard({ connectionsKey, connectReady, onConnectGmail }: Props) {
  const [status, setStatus] = useState<DigestStatus | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    fetchDigestStatus()
      .then(setStatus)
      .catch((error: Error) => setResult({ tone: 'error', text: `Could not load the daily email: ${error.message}` }))
  }, [connectionsKey])

  async function handleSendNow() {
    setSending(true)
    setResult(null)
    try {
      const outcome = await sendDigestNow()
      if (outcome.status === 'sent') {
        setResult({ tone: 'success', text: `Sent ${outcome.total} pending ${outcome.total === 1 ? 'task' : 'tasks'} to ${outcome.to}.` })
      } else if (outcome.status === 'skipped') {
        setResult({ tone: 'success', text: `Nothing sent: ${outcome.reason}` })
      } else {
        setResult({ tone: 'error', text: outcome.error })
      }
      setStatus(await fetchDigestStatus())
    } catch (error) {
      setResult({ tone: 'error', text: (error as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="integrations__section">
      <h2 className="section-title">Daily email</h2>
      <div className="digest-card">
        <div className="digest-card__body">
          <p className="digest-card__title">Pending tasks, every night at 12:00 AM</p>
          {!status ? (
            <p className="digest-card__meta">Loading…</p>
          ) : status.gmailConnected ? (
            <p className="digest-card__meta">
              Sent from your Gmail{status.to ? ` to ${status.to}` : ''}. Next:{' '}
              {whenFormatter.format(new Date(status.nextRunAt))}
              {status.lastSentAt && ` · Last sent ${whenFormatter.format(new Date(status.lastSentAt))}`}
            </p>
          ) : (
            <p className="digest-card__meta">Connect Gmail to turn it on. The email comes from your own account.</p>
          )}
          {status?.lastError && !result && (
            <p className="digest-card__meta app-row__meta--warning">Last attempt failed: {status.lastError}</p>
          )}
          {result && (
            <p className={`digest-card__meta${result.tone === 'error' ? ' app-row__meta--warning' : ''}`} role="status">
              {result.text}
            </p>
          )}
        </div>
        {status?.gmailConnected ? (
          <button className="btn btn--ghost" disabled={sending} onClick={handleSendNow}>
            {sending ? 'Sending…' : 'Send now'}
          </button>
        ) : (
          <button className="btn btn--primary" disabled={!connectReady || !status} onClick={onConnectGmail}>
            Connect Gmail
          </button>
        )}
      </div>
    </section>
  )
}
