import { createContext, useContext } from 'react'
import type { Task, TaskDraft, TaskPatch } from '../types/task'

export interface TasksContextValue {
  tasks: Task[]
  loaded: boolean
  addTask: (draft: TaskDraft) => void
  updateTask: (id: string, patch: TaskPatch) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  clearCompleted: () => void
  /** Runs the GTWY agent on a task. Called automatically on add; exposed for retries. */
  analyzeTask: (id: string) => void
  /** Analysis state that isn't persisted: in flight, or the last error. */
  analysisState: Record<string, { pending: true } | { pending: false; error: string }>
}

export const TasksContext = createContext<TasksContextValue | null>(null)

export function useTasks(): TasksContextValue {
  const value = useContext(TasksContext)
  if (!value) throw new Error('useTasks must be used inside <TasksProvider>')
  return value
}
