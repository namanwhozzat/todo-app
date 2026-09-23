# Tasks

A minimal Todo web app — React 19 + TypeScript + Vite. Tasks persist locally
(`localStorage`). A small Node server backs the Integrations page, which
connects third-party apps through [viaSocket](https://viasocket.com).

```bash
npm install
cp .env.example .env   # then set VIASOCKET_EMBED_SECRET
npm run dev:api        # API on :8787 (Node 20.6+, no dependencies)
npm run dev            # app on :5173, proxies /api to the API
npm run build          # typecheck + production build
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
| `src/components/IntegrationsPage.tsx` | Search the viaSocket catalog, connect and disconnect apps. |
| `src/integrations/` | API client, connect-popup loader, and a name/icon cache for connected apps. |
| `server/` | Signs viaSocket embed tokens and proxies the Apps API. Holds the only copy of the signing secret. |
| `server/digest.mjs` | Emails all pending tasks at local midnight through the user's connected Gmail. |
| `src/storage/syncedTaskRepository.ts` | localStorage plus a server copy (`data/tasks.json`) the digest reads. |

## Views

- **Today** — incomplete tasks due today, overdue, or with no due date.
- **Upcoming** — incomplete tasks due after today.
- **Completed** — everything done, most recently finished first.
- **Integrations** — search 2,000+ apps and connect an account through viaSocket's
  popup. viaSocket stores the credentials; this app keeps none.

**Daily email.** Connect Gmail on the Integrations page and the server emails
every pending task — grouped Overdue / Today / Upcoming / No due date — at
12:00 AM in the server's timezone, to the Gmail account itself (override with
`DIGEST_EMAIL`). It only fires while `npm run dev:api` is running; a midnight
missed while it was down is sent on the next start. Nothing is sent when no
tasks are pending. "Send now" on the page sends one immediately.

The app has no accounts yet, so every connection belongs to one local user
(`VIASOCKET_USER_ID`). When sign-in lands, return the signed-in user's stable id
from `currentUserId()` in `server/index.mjs` — and never change it for an
existing user, or their connections disappear.
