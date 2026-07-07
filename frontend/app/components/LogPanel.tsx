import { useCallback, useEffect, useState } from 'react'

import { AccessLog, apiJson, buildQuery } from '../lib/api'
import { emptyLogFilters, nextLogFilters } from '../lib/logFilters'

const PAGE_SIZE = 20

type LogPanelProps = {
  active: boolean
  refreshKey?: number
}

export function LogPanel({ active, refreshKey = 0 }: LogPanelProps) {
  const [filters, setFilters] = useState(emptyLogFilters)
  const [rows, setRows] = useState<AccessLog[]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  const loadLogs = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: (filters.page - 1) * PAGE_SIZE,
        q: filters.q,
        status: filters.status,
        start_date: filters.startDate,
        end_date: filters.endDate,
      }
      const [nextRows, nextCount] = await Promise.all([
        apiJson<AccessLog[]>(`/api/logs${buildQuery(params)}`),
        apiJson<{ count: number }>(`/api/logs/count${buildQuery(params)}`),
      ])
      setRows(nextRows)
      setCount(nextCount.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs')
    } finally {
      setBusy(false)
    }
  }, [filters])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs, refreshKey])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const exportHref = `/api/logs/export.csv${buildQuery({
    q: filters.q,
    status: filters.status,
    start_date: filters.startDate,
    end_date: filters.endDate,
  })}`

  return (
    <section className={`panel${active ? ' active' : ''}`} id="panel-log">
      <div className="log-header">
        <h2 className="log-title">Access log</h2>
        <a className="btn btn-ghost btn-refresh" href={exportHref} download>
          Export CSV
        </a>
        <button className="btn btn-ghost btn-refresh" id="btnRefresh" type="button" onClick={() => void loadLogs()} disabled={busy}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M14 8A6 6 0 112 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="log-filters">
        <input
          className="field-input"
          type="search"
          placeholder="Search logs…"
          value={filters.q}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { q: event.target.value }))}
        />
        <select
          className="field-input"
          value={filters.status}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { status: event.target.value as typeof filters.status }))}
        >
          <option value="">All statuses</option>
          <option value="ALLOWED">Allowed</option>
          <option value="DENIED">Denied</option>
        </select>
        <input
          className="field-input"
          type="date"
          aria-label="Start date"
          value={filters.startDate}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { startDate: event.target.value }))}
        />
        <input
          className="field-input"
          type="date"
          aria-label="End date"
          value={filters.endDate}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { endDate: event.target.value }))}
        />
        <button className="btn btn-ghost" type="button" onClick={() => setFilters(emptyLogFilters)}>
          Clear
        </button>
      </div>

      {error && <div className="log-empty">{error}</div>}

      <div className="log-table-wrap">
        <table className="log-table">
          <thead>
            <tr><th>Time</th><th>Name</th><th>Status</th><th>Match %</th><th>Duration</th><th>Description</th></tr>
          </thead>
          <tbody id="logTableBody">
            {busy ? (
              <tr className="log-empty-row"><td colSpan={6}><div className="log-empty"><span>Loading access log…</span></div></td></tr>
            ) : rows.length === 0 ? (
              <tr className="log-empty-row"><td colSpan={6}><div className="log-empty"><span>No access attempts recorded yet</span></div></td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td>{row.timestamp}</td>
                <td>{row.matched_name || 'Unknown'}</td>
                <td><span className={`log-status ${row.status === 'ALLOWED' ? 'allowed' : 'denied'}`}>{row.status}</span></td>
                <td>{Math.round(row.similarity * 100)}%</td>
                <td>{row.duration_ms == null ? '—' : `${row.duration_ms} ms`}</td>
                <td>{row.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="log-pagination" id="logPagination">
        <button className="btn btn-ghost btn-pag" id="btnLogPrev" type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Prev</button>
        <span className="pag-info" id="pagInfo">Page {filters.page} of {pages}</span>
        <button className="btn btn-ghost btn-pag" id="btnLogNext" type="button" disabled={filters.page >= pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>
    </section>
  )
}
