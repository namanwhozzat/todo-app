# Tasks

A minimal Todo web app — React 19 + TypeScript + Vite. Tasks persist locally
(`localStorage`).

```bash
npm install
npm run dev     # app on :5173
npm run build   # typecheck + production build
```

## Structure

| Path | Role |
| --- | --- |
| `src/types/task.ts` | The `Task` model. |
| `src/storage/TaskRepository.ts` | Async persistence interface — the swap point for a real backend. |
| `src/storage/localTaskRepository.ts` | `localStorage` adapter used today. |
| `src/state/tasksReducer.ts` | All task mutations, as pure reducer cases. |
| `src/state/selectors.ts` | Which tasks belong to Today / Upcoming / Completed, and how they sort. |
| `src/state/TasksProvider.tsx` | Hydrates from the repository, persists on change, exposes CRUD. |
| `src/components/` | Sidebar, task list, composer, and per-task row UI. |

## Views

- **Today** — incomplete tasks due today, overdue, or with no due date.
- **Upcoming** — incomplete tasks due after today.
- **Completed** — everything done, most recently finished first.
