import { useEffect, useState } from 'react'
import { digestApi, type AppSummary, type Connection, type DigestStatus } from '../integrations/api'

interface Props {
  /** Re-read status whenever the user's connections change (Gmail connected or removed). */
  connections: Connection[]
  onConnect: (app: AppSummary) => void
  connecting: boolean
}

const hourLabel = (hour: number) =>
  new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function DailyDigest({ connections, onConnect, connecting }: Props) {
  const [status, setStatus] = useState<DigestStatus | null>(null)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    digestApi.status().then(
      (s) => {
        setStatus(s)
        setEmail(s.email || s.suggestedEmail || '')
      },
      (e: Error) => setMessage({ tone: 'error', text: e.message }),
    )
  }, [connections])

  if (!status) return null

  async function save(enabled: boolean) {
    setSaving(true)
    setMessage(null)
    try {
      const next = await digestApi.update({ enabled, email })
      setStatus(next)
      setMessage({ tone: 'ok', text: enabled ? `Daily email on — next one at ${hourLabel(next.hour)}.` : 'Daily email off.' })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save' })
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setSaving(true)
    setMessage(null)
    try {
      const { count } = await digestApi.sendTest()
      setMessage({ tone: 'ok', text: `Sent to ${status!.email} with ${count} pending ${count === 1 ? 'task' : 'tasks'}.` })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not send' })
    } finally {
      setSaving(false)
    }
  }

  const { gmail } = status

  return (
    <section className="integrations__section">
      <h2 className="integrations__heading">Daily email</h2>
      <div className="digest">
        <p className="digest__lead">
          Every day at {hourLabel(status.hour)}, email me all my pending tasks from my Gmail.
        </p>

        {!gmail.connected ? (
          <button
            className="btn btn--primary digest__connect"
            disabled={connecting}
            onClick={() => onConnect({ ...gmail, description: '' })}
          >
            <img src={gmail.iconUrl} alt="" width={16} height={16} />
            {connecting ? 'Connecting…' : 'Connect Gmail'}
          </button>
        ) : (
          <div className="digest__row">
            <input
              className="integrations__search digest__email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Send the daily email to"
            />
            {status.enabled ? (
              <>
                {email.trim() !== status.email && (
                  <button className="btn btn--primary" disabled={saving} onClick={() => save(true)}>
                    Save
                  </button>
                )}
                <button className="btn btn--ghost" disabled={saving} onClick={sendTest}>
                  Send now
                </button>
                <button className="btn btn--ghost app-row__danger" disabled={saving} onClick={() => save(false)}>
                  Turn off
                </button>
              </>
            ) : (
              <button className="btn btn--primary" disabled={saving || !email.trim()} onClick={() => save(true)}>
                Turn on
              </button>
            )}
          </div>
        )}

        {status.enabled && status.lastSentOn && !message && (
          <p className="digest__note">Last sent {new Date(`${status.lastSentOn}T00:00`).toLocaleDateString()}.</p>
        )}
        {message && (
          <p className={`digest__note${message.tone === 'error' ? ' digest__note--error' : ''}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
