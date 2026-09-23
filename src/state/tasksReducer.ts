import type { Task, TaskDraft, TaskPatch } from '../types/task'
import { createId } from '../lib/id'

export interface TasksState {
  tasks: Task[]
  loaded: boolean
}

export type TasksAction =
  | { type: 'hydrate'; tasks: Task[] }
  | { type: 'add'; draft: TaskDraft }
  | { type: 'update'; id: string; patch: TaskPatch }
  | { type: 'toggle'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clearCompleted' }

export const initialTasksState: TasksState = { tasks: [], loaded: false }

function stamp(task: Task): Task {
  return { ...task, updatedAt: new Date().toISOString() }
}

export function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  switch (action.type) {
    case 'hydrate':
      return { tasks: action.tasks, loaded: true }

    case 'add': {
      const now = new Date().toISOString()
      const task: Task = {
        id: createId(),
        title: action.draft.title.trim(),
        description: action.draft.description?.trim() ?? '',
        dueAt: action.draft.dueAt ?? null,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      return { ...state, tasks: [task, ...state.tasks] }
    }

    case 'update':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? stamp({ ...t, ...action.patch }) : t,
        ),
      }

    case 'toggle':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id) return t
          const completed = !t.completed
          return stamp({
            ...t,
            completed,
            completedAt: completed ? new Date().toISOString() : null,
          })
        }),
      }

    case 'remove':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }

    case 'clearCompleted':
      return { ...state, tasks: state.tasks.filter((t) => !t.completed) }

    default:
      return state
  }
}
