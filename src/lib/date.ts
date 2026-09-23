/** Date helpers. All comparisons are done in the viewer's local timezone. */

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function isToday(iso: string): boolean {
  return isSameDay(new Date(iso), new Date())
}

/** Due strictly before today's 00:00. */
export function isOverdue(iso: string): boolean {
  return startOfDay(new Date(iso)).getTime() < startOfDay(new Date()).getTime()
}

/** Due strictly after today's 23:59. */
export function isFuture(iso: string): boolean {
  return startOfDay(new Date(iso)).getTime() > startOfDay(new Date()).getTime()
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

/** "Today · 14:30", "Tomorrow", "Fri, Sep 19 · 09:00". */
export function formatDue(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let day: string
  if (isSameDay(date, today)) day = 'Today'
  else if (isSameDay(date, tomorrow)) day = 'Tomorrow'
  else day = dayFormatter.format(date)

  // Midnight is treated as "no specific time" — the date alone reads cleaner.
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  return hasTime ? `${day} · ${timeFormatter.format(date)}` : day
}

/** ISO string -> value for <input type="datetime-local">, in local time. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value -> ISO string. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Today at 17:00 local — the default when a user clicks "Today". */
export function todayAt(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function tomorrowAt(hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
