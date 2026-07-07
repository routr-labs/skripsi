export function AppHeader() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-mark">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="6" stroke="currentColor" strokeWidth="2" />
            <circle cx="14" cy="14" r="2" fill="currentColor" />
            <path d="M14 2v4M14 22v4M2 14h4M22 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="header-brand">
          <span className="brand-name">PalmGate</span>
          <span className="brand-sub">Biometric access</span>
        </div>
      </div>
      <div className="header-right">
        <div className="status-dot" id="systemStatus" />
        <span className="status-label" id="systemStatusLabel">Online</span>
      </div>
    </header>
  )
}
