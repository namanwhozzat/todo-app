/**
 * Wrapper around viaSocket's connect popup script. The script exposes one
 * global, `openViasocketConnection`, and injects nothing until it is called.
 */

const SCRIPT_ID = 'viasocket-connect-script'
const SCRIPT_SRC = 'https://embed.viasocket.com/prod-connectcomponent.js'

export type ConnectResult =
  | { status: 'success'; data: { id: string } }
  | { status: 'error'; error?: { message?: string } }
  | { status: 'closed' }

declare global {
  interface Window {
    openViasocketConnection?: (embedToken: string, serviceId: string) => Promise<ConnectResult>
  }
}

let loading: Promise<void> | null = null

export function loadConnectScript(): Promise<void> {
  if (window.openViasocketConnection) return Promise.resolve()
  if (loading) return loading

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Could not load the viaSocket connect script.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Must be called synchronously from a click: the script opens its popup
 * before any network call, or the browser blocks it. So the token and the
 * script have to be ready before the user clicks.
 */
export function openConnection(embedToken: string, serviceId: string): Promise<ConnectResult> {
  if (!window.openViasocketConnection) {
    return Promise.resolve({ status: 'error', error: { message: 'Connect script is not loaded yet.' } })
  }
  return window.openViasocketConnection(embedToken, serviceId)
}
