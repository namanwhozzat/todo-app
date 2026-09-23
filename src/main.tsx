import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { TasksProvider } from './state/TasksProvider'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TasksProvider>
      <App />
    </TasksProvider>
  </StrictMode>,
)
