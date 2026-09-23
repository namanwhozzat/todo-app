import { useState } from 'react'
import type { Task } from '../types/task'
import { useTasks } from '../state/TasksContext'
import { formatDue, isOverdue } from '../lib/date'
import { TaskForm } from './TaskForm'

export function TaskItem({ task }: { task: Task }) {
  const { toggleTask, updateTask, removeTask } = useTasks()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="task task--editing">
        <TaskForm
          autoFocus
          submitLabel="Save"
          initial={{ title: task.title, description: task.description, dueAt: task.dueAt }}
          onSubmit={(values) => {
            updateTask(task.id, values)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  const overdue = !task.completed && task.dueAt !== null && isOverdue(task.dueAt)

  return (
    <li className={`task${task.completed ? ' task--done' : ''}`}>
      <button
        className="task__check"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
        onClick={() => toggleTask(task.id)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 8.5l2.5 2.5L12 5.5" />
        </svg>
      </button>

      <div className="task__body">
        <p className="task__title">{task.title}</p>
        {task.description && <p className="task__description">{task.description}</p>}
        {task.dueAt && (
          <p className={`task__due${overdue ? ' task__due--overdue' : ''}`}>
            {overdue && <span className="task__due-flag">Overdue</span>}
            {formatDue(task.dueAt)}
          </p>
        )}
      </div>

      <div className="task__controls">
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label={`Edit "${task.title}"`}>
          Edit
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => removeTask(task.id)}
          aria-label={`Delete "${task.title}"`}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
