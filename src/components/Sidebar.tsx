import type { ViewId } from '../types/task'

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

interface Props {
  active: ViewId
  counts: Record<ViewId, number>
  onSelect: (page: ViewId) => void
}

export function Sidebar({ active, counts, onSelect }: Props) {
  const item = (id: ViewId) => ({
    className: `nav-item${active === id ? ' nav-item--active' : ''}`,
    'aria-current': active === id ? ('page' as const) : undefined,
    onClick: () => onSelect(id),
  })

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">Tasks</div>
      <nav className="sidebar__nav">
        {VIEWS.map((view) => (
          <button key={view.id} {...item(view.id)}>
            <span>{view.label}</span>
            {counts[view.id] > 0 && <span className="nav-item__count">{counts[view.id]}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
