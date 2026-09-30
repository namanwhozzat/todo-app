import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { aiApi } from '../integrations/api'
import { createId } from '../lib/id'
import type { TaskRepository } from '../storage/TaskRepository'
import type { Task } from '../types/task'
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
  const [analysisState, setAnalysisState] = useState<TasksContextValue['analysisState']>({})
  const tasksRef = useRef(state.tasks)
  tasksRef.current = state.tasks

  const runAnalysis = useCallback((task: Pick<Task, 'id' | 'title' | 'description' | 'dueAt'>) => {
    setAnalysisState((s) => ({ ...s, [task.id]: { pending: true } }))
    aiApi.analyze(task).then(
      (analysis) => {
        // The task may have been deleted while the agent was thinking.
        if (tasksRef.current.some((t) => t.id === task.id)) {
          dispatch({ type: 'update', id: task.id, patch: { analysis } })
        }
        setAnalysisState(({ [task.id]: _, ...rest }) => rest)
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Analysis failed'
        setAnalysisState((s) => ({ ...s, [task.id]: { pending: false, error: message } }))
      },
    )
  }, [])

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
      addTask: (draft) => {
        const id = createId()
        dispatch({ type: 'add', id, draft })
        runAnalysis({
          id,
          title: draft.title.trim(),
          description: draft.description?.trim() ?? '',
          dueAt: draft.dueAt ?? null,
        })
      },
      updateTask: (id, patch) => dispatch({ type: 'update', id, patch }),
      toggleTask: (id) => dispatch({ type: 'toggle', id }),
      removeTask: (id) => dispatch({ type: 'remove', id }),
      clearCompleted: () => dispatch({ type: 'clearCompleted' }),
      analyzeTask: (id) => {
        const task = state.tasks.find((t) => t.id === id)
        if (task) runAnalysis(task)
      },
      analysisState,
    }),
    [state.tasks, state.loaded, analysisState, runAnalysis],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
