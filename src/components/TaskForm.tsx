import { useEffect, useRef, useState } from 'react'
import { fromLocalInputValue, toLocalInputValue, todayAt, tomorrowAt } from '../lib/date'

export interface TaskFormValues {
  title: string
  description: string
  dueAt: string | null
}

interface Props {
  initial?: Partial<TaskFormValues>
  submitLabel: string
  onSubmit: (values: TaskFormValues) => void
  onCancel?: () => void
  autoFocus?: boolean
}

const EMPTY: TaskFormValues = { title: '', description: '', dueAt: null }

/** Shared fields for both creating and editing a task. */
export function TaskForm({ initial, submitLabel, onSubmit, onCancel, autoFocus }: Props) {
  const [values, setValues] = useState<TaskFormValues>({ ...EMPTY, ...initial })
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus()
  }, [autoFocus])

  const canSubmit = values.title.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onSubmit({ ...values, title: values.title.trim(), description: values.description.trim() })
    setValues({ ...EMPTY, ...initial })
  }

  return (
    <form
      className="task-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) onCancel()
        // Cmd/Ctrl+Enter submits from the description field too.
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          submit()
        }
      }}
    >
      <input
        ref={titleRef}
        className="task-form__title"
        placeholder="What needs doing?"
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        aria-label="Task title"
      />

      <textarea
        className="task-form__description"
        placeholder="Notes (optional)"
        rows={2}
        value={values.description}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        aria-label="Task description"
      />

      <div className="task-form__row">
        <input
          type="datetime-local"
          className="task-form__due"
          value={toLocalInputValue(values.dueAt)}
          onChange={(e) =>
            setValues((v) => ({ ...v, dueAt: fromLocalInputValue(e.target.value) }))
          }
          aria-label="Due date and time"
        />
        <div className="task-form__presets">
          <button type="button" onClick={() => setValues((v) => ({ ...v, dueAt: todayAt(17) }))}>
            Today
          </button>
          <button type="button" onClick={() => setValues((v) => ({ ...v, dueAt: tomorrowAt(9) }))}>
            Tomorrow
          </button>
          <button type="button" onClick={() => setValues((v) => ({ ...v, dueAt: null }))}>
            Clear
          </button>
        </div>
      </div>

      <div className="task-form__actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
