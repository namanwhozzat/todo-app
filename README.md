# Tasks

A minimal Todo web app — React 19 + TypeScript + Vite. Tasks persist locally
(`localStorage`).

```bash
npm install
npm run dev     # app on :5173
npm run dev:api # integrations API on :8787 (needs .env, see below)
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
| `src/components/IntegrationsPage.tsx` | Search apps and connect / disconnect them via viaSocket. |
| `server/` | Small Node API that holds the viaSocket signing secret and stores connections. |

## Views

- **Today** — incomplete tasks due today, overdue, or with no due date.
- **Upcoming** — incomplete tasks due after today.
- **Completed** — everything done, most recently finished first.

## Integrations

The Integrations page lets a user search viaSocket's app catalog and connect
accounts through viaSocket's popup. The server needs `VIASOCKET_ORG_ID`,
`VIASOCKET_PROJECT_ID` and `VIASOCKET_EMBED_SECRET` in `.env` (from
flow.viasocket.com → Integrations → Install Code). Only the opaque `auth_id`
and `service_id` are stored, in `server/data/connections.json`.

### Daily email

On the Integrations page, connect Gmail and turn on **Daily email**. Every day
at 9:00 (server local time; override with `DIGEST_HOUR` in `.env`) the server
emails all incomplete tasks, grouped into overdue / today / upcoming / no date,
from the user's own Gmail via viaSocket. The browser pushes tasks to the server
on every change (`PUT /api/tasks`) so the email works with the tab closed — but
`npm run dev:api` must be running at 9:00. If it starts later the same day, it
catches up once.

### AI task analysis (GTWY.ai)

When a task is added, the server sends it to a [GTWY.ai](https://gtwy.ai) agent
(`POST /api/v2/model/chat/completion`) and the task row shows the result:
priority, category, time estimate, a one-line summary and suggested steps.
Existing tasks get an **Analyze** / **Re-analyze** button.

1. At app.gtwy.ai, create an agent (any model). A system prompt such as
   *"You analyze to-do tasks and reply with only the JSON object requested."*
   works well; the app also spells out the JSON format in every message.
2. Add to `.env`:
   ```
   GTWY_PAUTHKEY=...     # your org's auth key (pauthkey)
   GTWY_AGENT_ID=...     # the agent's id
   # GTWY_API_URL=https://api.gtwy.ai   (optional)
   ```
3. Restart `npm run dev:api`.

The key never reaches the browser; `server/gtwy.js` makes the call and the
browser stores the analysis on the task in `localStorage`.
