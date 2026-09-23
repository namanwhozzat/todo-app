import { useMemo, useState } from 'react'
import type { PageId, ViewId } from '../types/task'
import { useTasks } from '../state/TasksContext'
import { countView, selectView } from '../state/selectors'
import { IntegrationsPage } from './IntegrationsPage'
import { Sidebar } from './Sidebar'
import { TaskComposer } from './TaskComposer'
import { TaskList } from './TaskList'

const VIEW_TITLES: Record<ViewId, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  completed: 'Completed',
}

const todayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function App() {
  const { tasks } = useTasks()
  const [page, setPage] = useState<PageId>('today')

  const counts = useMemo(
    () => ({
      today: countView(tasks, 'today'),
      upcoming: countView(tasks, 'upcoming'),
      completed: countView(tasks, 'completed'),
    }),
    [tasks],
  )

  return (
    <div className="app">
      <Sidebar active={page} counts={counts} onSelect={setPage} />

      <main className="main">
        {page === 'integrations' ? <IntegrationsPage /> : <TasksView view={page} />}
      </main>
    </div>
  )
}

function TasksView({ view }: { view: ViewId }) {
  const { tasks, loaded, clearCompleted } = useTasks()
  const visible = useMemo(() => selectView(tasks, view), [tasks, view])

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">{VIEW_TITLES[view]}</h1>
          <p className="main__subtitle">
            {view === 'today'
              ? todayLabel.format(new Date())
              : `${visible.length} ${visible.length === 1 ? 'task' : 'tasks'}`}
          </p>
        </div>
        {view === 'completed' && visible.length > 0 && (
          <button className="btn btn--ghost" onClick={clearCompleted}>
            Clear all
          </button>
        )}
      </header>

      {loaded && view !== 'completed' && <TaskComposer view={view} />}
      {loaded && <TaskList tasks={visible} view={view} />}
    </>
  )
}
