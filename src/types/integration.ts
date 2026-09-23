/** An app in the viaSocket catalog. */
export interface IntegrationApp {
  serviceId: string
  name: string
  description: string
  iconUrl: string | null
}

/** One account the user has connected. Name and icon may be missing; resolve them from the catalog. */
export interface Connection {
  authId: string
  serviceId: string | null
  name: string | null
  iconUrl: string | null
  /** The account inside the app, when viaSocket reports one (an email, a workspace). */
  label: string | null
  /** The app revoked or timed out the grant; the user must connect again. */
  expired: boolean
  updatedAt: string | null
}
