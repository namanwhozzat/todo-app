import { request } from '../integrations/api'
import type { TaskRepository } from './TaskRepository'
import { localTaskRepository } from './localTaskRepository'

const SYNC_DEBOUNCE_MS = 1000
let pending: ReturnType<typeof setTimeout> | undefined

/**
 * localStorage stays the source of truth; every save is also pushed to the server so the
 * daily email can read tasks while the tab is closed. A server that is down is ignored.
 */
export const syncedTaskRepository: TaskRepository = {
  load: () => localTaskRepository.load(),

  async save(tasks) {
    await localTaskRepository.save(tasks)
    clearTimeout(pending)
    pending = setTimeout(() => {
      request('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      }).catch(() => {})
    }, SYNC_DEBOUNCE_MS)
  },
}
