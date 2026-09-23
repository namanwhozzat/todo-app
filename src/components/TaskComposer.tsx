import { useState } from 'react'
import { useTasks } from '../state/TasksContext'
import { TaskForm } from './TaskForm'
import type { ViewId } from '../types/task'
import { todayAt, tomorrowAt } from '../lib/date'

/** Default due date depends on where the task is being created. */
function defaultDueFor(view: ViewId): string | null {
  if (view === 'today') return todayAt(17)
  if (view === 'upcoming') return tomorrowAt(9)
  return null
}

export function TaskComposer({ view }: { view: ViewId }) {
  const { addTask } = useTasks()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button className="composer-trigger" onClick={() => setOpen(true)}>
        <span className="composer-trigger__plus" aria-hidden="true">
          +
        </span>
        Add a task
      </button>
    )
  }

  return (
    <div className="composer">
      <TaskForm
        autoFocus
        submitLabel="Add task"
        initial={{ dueAt: defaultDueFor(view) }}
        onSubmit={(values) => {
          addTask(values)
          setOpen(false)
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
