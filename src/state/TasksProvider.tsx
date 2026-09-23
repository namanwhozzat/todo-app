import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { TaskRepository } from '../storage/TaskRepository'
import { syncedTaskRepository } from '../storage/syncedTaskRepository'
import { initialTasksState, tasksReducer } from './tasksReducer'
import { TasksContext, type TasksContextValue } from './TasksContext'
import { createSeedTasks } from './seed'

interface Props {
  children: ReactNode
  /** Injectable so tests — or a future API-backed build — can swap persistence. */
  repository?: TaskRepository
  seedWhenEmpty?: boolean
}

export function TasksProvider({
  children,
  repository = syncedTaskRepository,
  seedWhenEmpty = true,
}: Props) {
  const [state, dispatch] = useReducer(tasksReducer, initialTasksState)

  useEffect(() => {
    let cancelled = false
    void repository.load().then((tasks) => {
      if (cancelled) return
      dispatch({
        type: 'hydrate',
        tasks: tasks.length === 0 && seedWhenEmpty ? createSeedTasks() : tasks,
      })
    })
    return () => {
      cancelled = true
    }
  }, [repository, seedWhenEmpty])

  // Persist after every change, but never before hydration — otherwise the
  // initial empty state would overwrite what's on disk.
  useEffect(() => {
    if (!state.loaded) return
    void repository.save(state.tasks)
  }, [repository, state.loaded, state.tasks])

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks: state.tasks,
      loaded: state.loaded,
      addTask: (draft) => dispatch({ type: 'add', draft }),
      updateTask: (id, patch) => dispatch({ type: 'update', id, patch }),
      toggleTask: (id) => dispatch({ type: 'toggle', id }),
      removeTask: (id) => dispatch({ type: 'remove', id }),
      clearCompleted: () => dispatch({ type: 'clearCompleted' }),
    }),
    [state.tasks, state.loaded],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
