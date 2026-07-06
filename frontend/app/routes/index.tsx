import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppHeader } from '../components/AppHeader'
import { LogPanel } from '../components/LogPanel'
import { RegisterPanel } from '../components/RegisterPanel'
import { ScanPanel } from '../components/ScanPanel'
import { UserList } from '../components/UserList'

type Tab = 'scan' | 'register' | 'log'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const [tab, setTab] = useState<Tab>('scan')
  const [logRefreshKey, setLogRefreshKey] = useState(0)
  const refreshLogs = () => setLogRefreshKey((key) => key + 1)

  return (
    <main className="dashboard-shell">
      <AppHeader />
      <nav className="tabs" aria-label="Dashboard tabs">
        {(['scan', 'register', 'log'] as const).map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            type="button"
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      {tab === 'scan' && <ScanPanel />}
      {tab === 'register' && <RegisterPanel />}
      {tab === 'log' && <LogPanel refreshKey={logRefreshKey} />}
      <UserList onUsersChanged={refreshLogs} />
    </main>
  )
}
