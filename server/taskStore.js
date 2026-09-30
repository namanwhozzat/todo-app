/**
 * Server copy of each user's tasks, pushed from the browser on every change, so the daily
 * digest can read them while the tab is closed. The browser's localStorage stays the source
 * of truth.
 */
import { jsonFile } from './jsonFile.js'

const file = jsonFile('tasks.json', {})

export const taskStore = {
  async get(userId) {
    return (await file.read())[userId] ?? []
  },

  async replace(userId, tasks) {
    const all = await file.read()
    all[userId] = tasks
    await file.write(all)
  },
}
