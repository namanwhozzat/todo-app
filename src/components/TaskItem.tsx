import { useState } from 'react'
import type { Task, TaskAnalysis } from '../types/task'
import { useTasks } from '../state/TasksContext'
import { formatDue, isOverdue } from '../lib/date'
import { TaskForm } from './TaskForm'

export function TaskItem({ task }: { task: Task }) {
  const { toggleTask, updateTask, removeTask, analyzeTask, analysisState } = useTasks()
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

  const ai = analysisState[task.id]
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
        {ai?.pending ? (
          <p className="task__ai-status">Analyzing with AI…</p>
        ) : ai ? (
          <p className="task__ai-status task__ai-status--error">
            AI analysis failed: {ai.error}{' '}
            <button className="link-btn" onClick={() => analyzeTask(task.id)}>
              Retry
            </button>
          </p>
        ) : (
          task.analysis && !task.completed && <TaskAnalysisView analysis={task.analysis} />
        )}
      </div>

      <div className="task__controls">
        {!task.completed && (
          <button
            className="icon-btn"
            onClick={() => analyzeTask(task.id)}
            disabled={ai?.pending}
            aria-label={`Analyze "${task.title}" with AI`}
          >
            {task.analysis ? 'Re-analyze' : 'Analyze'}
          </button>
        )}
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

function TaskAnalysisView({ analysis }: { analysis: TaskAnalysis }) {
  return (
    <div className="task__ai">
      <div className="task__ai-tags">
        <span className={`ai-tag ai-tag--${analysis.priority}`}>{analysis.priority} priority</span>
        {analysis.category && <span className="ai-tag">{analysis.category}</span>}
        {analysis.estimateMinutes !== null && <span className="ai-tag">~{formatMinutes(analysis.estimateMinutes)}</span>}
      </div>
      {analysis.summary && <p className="task__ai-summary">{analysis.summary}</p>}
      {analysis.subtasks.length > 0 && (
        <details className="task__ai-steps">
          <summary>{analysis.subtasks.length} suggested steps</summary>
          <ol>
            {analysis.subtasks.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} h`
}
