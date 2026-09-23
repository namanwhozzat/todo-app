import type { Task, ViewId } from '../types/task'
import { TaskItem } from './TaskItem'

const EMPTY_COPY: Record<ViewId, { title: string; hint: string }> = {
  today: { title: 'Nothing due today', hint: 'Add a task to get going.' },
  upcoming: { title: 'Nothing scheduled', hint: 'Tasks with a future due date land here.' },
  completed: { title: 'No completed tasks yet', hint: 'Finished tasks are archived here.' },
}

export function TaskList({ tasks, view }: { tasks: Task[]; view: ViewId }) {
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{EMPTY_COPY[view].title}</p>
        <p className="empty__hint">{EMPTY_COPY[view].hint}</p>
      </div>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  )
}
