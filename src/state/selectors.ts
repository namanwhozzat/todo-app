import type { Task, ViewId } from '../types/task'
import { isFuture, isOverdue, isToday } from '../lib/date'

/**
 * View membership rules, kept in one place so the sidebar counts and the list
 * can never disagree.
 *
 * - today:    incomplete, due today or overdue, plus anything with no due date
 * - upcoming: incomplete, due after today
 * - completed: everything done
 */
export function belongsToView(task: Task, view: ViewId): boolean {
  if (view === 'completed') return task.completed
  if (task.completed) return false
  if (view === 'today') return task.dueAt === null || isToday(task.dueAt) || isOverdue(task.dueAt)
  return task.dueAt !== null && isFuture(task.dueAt)
}

/** Undated last; otherwise soonest first, then newest-created first. */
function compareTasks(a: Task, b: Task): number {
  if (a.dueAt && b.dueAt) {
    const diff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (diff !== 0) return diff
  } else if (a.dueAt !== b.dueAt) {
    return a.dueAt ? -1 : 1
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

/** Completed view reads best most-recently-finished first. */
function compareCompleted(a: Task, b: Task): number {
  return new Date(b.completedAt ?? b.updatedAt).getTime() -
    new Date(a.completedAt ?? a.updatedAt).getTime()
}

export function selectView(tasks: Task[], view: ViewId): Task[] {
  const filtered = tasks.filter((t) => belongsToView(t, view))
  return filtered.sort(view === 'completed' ? compareCompleted : compareTasks)
}

export function countView(tasks: Task[], view: ViewId): number {
  return tasks.reduce((n, t) => (belongsToView(t, view) ? n + 1 : n), 0)
}
