/**
 * Core domain model.
 *
 * `Task` is intentionally flat and serializable so any persistence adapter
 * (localStorage today, a real API later) can round-trip it as JSON.
 */
export interface Task {
  id: string
  title: string
  description: string
  /** ISO 8601 string, or null when the task has no due date. */
  dueAt: string | null
  completed: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
  /** Set by the GTWY agent after the task is added; null until then or if it failed. */
  analysis: TaskAnalysis | null
}

export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskAnalysis {
  summary: string
  priority: TaskPriority
  category: string
  estimateMinutes: number | null
  subtasks: string[]
  analyzedAt: string
}

/** Fields a user can supply when creating a task. */
export interface TaskDraft {
  title: string
  description?: string
  dueAt?: string | null
}

/** Fields that may be patched on an existing task. */
export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'dueAt' | 'completed' | 'analysis'>
>

export type ViewId = 'today' | 'upcoming' | 'completed'

/** Everything the sidebar can navigate to. */
export type Page = ViewId | 'integrations'
