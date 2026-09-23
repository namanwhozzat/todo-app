import type { Task } from '../types/task'
import type { TaskRepository } from './TaskRepository'
import { localTaskRepository } from './localTaskRepository'

async function push(tasks: Task[]) {
  try {
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    })
  } catch {
    // Server unreachable — it catches up on the next save.
  }
}

// Pushes run one at a time so an older list can never land after a newer one.
let pushing: Promise<void> = Promise.resolve()

/**
 * localStorage plus a copy on the API server, which the midnight email digest
 * reads. The server copy wins on load once it exists; localStorage keeps the
 * app working when the server is not running.
 */
export const syncedTaskRepository: TaskRepository = {
  async load() {
    try {
      const response = await fetch('/api/tasks')
      if (!response.ok) throw new Error(String(response.status))
      const { tasks } = (await response.json()) as { tasks: Task[] | null }
      if (tasks !== null) {
        await localTaskRepository.save(tasks)
        return tasks
      }
    } catch {
      // Server unreachable — local copy only.
    }
    // Never synced yet: the local copy is the truth, and the first save pushes it up.
    return localTaskRepository.load()
  },

  async save(tasks) {
    await localTaskRepository.save(tasks)
    pushing = pushing.then(() => push(tasks))
    await pushing
  },
}
