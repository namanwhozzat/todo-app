import type { Task } from '../types/task'
import { createId } from '../lib/id'
import { todayAt, tomorrowAt } from '../lib/date'

/** First-run sample tasks so an empty app still shows what it can do. */
export function createSeedTasks(): Task[] {
  const now = new Date().toISOString()
  const base = { completed: false, completedAt: null, createdAt: now, updatedAt: now }

  return [
    {
      ...base,
      id: createId(),
      title: 'Plan the week',
      description: 'Pick the three things that actually have to ship.',
      dueAt: todayAt(17),
    },
    {
      ...base,
      id: createId(),
      title: 'Review the task data model',
      description: '',
      dueAt: tomorrowAt(10),
    },
    {
      ...base,
      id: createId(),
      title: 'Write down open questions',
      description: 'Anything that needs a decision before wiring up real APIs.',
      dueAt: null,
    },
  ]
}
