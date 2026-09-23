import type { Task } from '../types/task'

/**
 * Persistence boundary. The app only ever talks to this interface, so the
 * localStorage adapter can be swapped for a remote one without touching state
 * or UI code.
 *
 * Methods are async on purpose: a future remote adapter is a drop-in.
 */
export interface TaskRepository {
  load(): Promise<Task[]>
  save(tasks: Task[]): Promise<void>
}
