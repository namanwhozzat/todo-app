import type { Task } from '../types/task'
import type { TaskRepository } from './TaskRepository'

const STORAGE_KEY = 'todo-app.tasks.v1'

/** Narrow an unknown parsed value into a Task, filling in anything missing. */
function reviveTask(raw: unknown): Task | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.title !== 'string') return null

  const now = new Date().toISOString()
  return {
    id: t.id,
    title: t.title,
    description: typeof t.description === 'string' ? t.description : '',
    dueAt: typeof t.dueAt === 'string' ? t.dueAt : null,
    completed: t.completed === true,
    completedAt: typeof t.completedAt === 'string' ? t.completedAt : null,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : now,
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : now,
  }
}

/**
 * Mock persistence for the prototype. Every read and write is defensive —
 * private windows and cleared site data make localStorage throw.
 */
export const localTaskRepository: TaskRepository = {
  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(reviveTask).filter((t): t is Task => t !== null)
    } catch {
      return []
    }
  },

  async save(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Storage unavailable or full — the in-memory session still works.
    }
  },
}
