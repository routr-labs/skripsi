import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppHeader } from '../components/AppHeader'
import { LogPanel } from '../components/LogPanel'
import { RegisterPanel } from '../components/RegisterPanel'
import { ScanPanel } from '../components/ScanPanel'
import { UserList } from '../components/UserList'

type Tab = 'scan' | 'register' | 'log' | 'user'

export const Route = createFileRoute('/')({ component: Dashboard })

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('scan')
  const [logRefreshKey, setLogRefreshKey] = useState(0)
  const refreshLogs = () => setLogRefreshKey((key) => key + 1)

  return (
    <>
      <AppHeader />
      <nav className="nav">
        <button className={`nav-btn${tab === 'scan' ? ' active' : ''}`} data-tab="scan" type="button" onClick={() => setTab('scan')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10.5H15.5M12.75 8V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Scan</span>
        </button>
        <button className={`nav-btn${tab === 'register' ? ' active' : ''}`} data-tab="register" type="button" onClick={() => setTab('register')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Register</span>
        </button>
        <button className={`nav-btn${tab === 'log' ? ' active' : ''}`} data-tab="log" type="button" onClick={() => setTab('log')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h8M2 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Log</span>
        </button>
        <button className={`nav-btn${tab === 'user' ? ' active' : ''}`} data-tab="user" type="button" onClick={() => setTab('user')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>User</span>
        </button>
      </nav>
      <main className="main">
        <ScanPanel active={tab === 'scan'} />
        <RegisterPanel active={tab === 'register'} />
        <LogPanel active={tab === 'log'} refreshKey={logRefreshKey} />
        <UserList active={tab === 'user'} onUsersChanged={refreshLogs} />
      </main>
    </>
  )
}
