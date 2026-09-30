/**
 * Connected apps, one JSON file for the prototype. Each record is the opaque viaSocket auth_id,
 * the app's service_id and the owning user — plus the app's public name and icon for display.
 * No third-party credential is ever stored: the auth_id is useless without the signing secret.
 */
import { jsonFile } from './jsonFile.js'

const file = jsonFile('connections.json', [])

async function readAll() {
  const records = await file.read()
  return Array.isArray(records) ? records : []
}

const writeAll = (records) => file.write(records)

const publicView = ({ serviceId, authId, name, iconUrl, connectedAt }) => ({
  serviceId,
  authId,
  name,
  iconUrl,
  connectedAt,
})

export const connectionStore = {
  async list(userId) {
    return (await readAll()).filter((r) => r.userId === userId).map(publicView)
  },

  /** The user's most recent connection to one app, or null. */
  async findByService(userId, serviceId) {
    const matches = (await readAll()).filter((r) => r.userId === userId && r.serviceId === serviceId)
    return matches.at(-1) ?? null
  },

  async find(userId, authId) {
    return (await readAll()).find((r) => r.userId === userId && r.authId === authId) ?? null
  },

  async add({ userId, serviceId, authId, name, iconUrl }) {
    const records = (await readAll()).filter((r) => !(r.userId === userId && r.authId === authId))
    const record = { userId, serviceId, authId, name, iconUrl, connectedAt: new Date().toISOString() }
    records.push(record)
    await writeAll(records)
    return publicView(record)
  },

  async remove(userId, authId) {
    const records = await readAll()
    await writeAll(records.filter((r) => !(r.userId === userId && r.authId === authId)))
  },
}
