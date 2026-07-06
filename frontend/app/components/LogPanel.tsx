import { useCallback, useEffect, useState } from 'react'

import { AccessLog, apiJson, buildQuery } from '../lib/api'
import { emptyLogFilters, nextLogFilters } from '../lib/logFilters'

const PAGE_SIZE = 20

type LogPanelProps = {
  refreshKey?: number
}

export function LogPanel({ refreshKey = 0 }: LogPanelProps) {
  const [filters, setFilters] = useState(emptyLogFilters)
  const [rows, setRows] = useState<AccessLog[]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const exportCsv = () => {
    const query = buildQuery({
      q: filters.q,
      status: filters.status,
      start_date: filters.startDate,
      end_date: filters.endDate,
    })
    window.location.href = `/api/logs/export.csv${query}`
  }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Access Log</h2>
        <button type="button" onClick={() => void loadLogs()} disabled={busy}>Refresh</button>
      </div>

      <div className="log-filters">
        <input
          aria-label="Search logs"
          placeholder="Search name, NIM, description"
          value={filters.q}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { q: event.target.value }))}
        />
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { status: event.target.value as typeof filters.status }))}
        >
          <option value="">All</option>
          <option value="ALLOWED">Allowed</option>
          <option value="DENIED">Denied</option>
        </select>
        <input
          aria-label="Start date"
          type="date"
          value={filters.startDate}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { startDate: event.target.value }))}
        />
        <input
          aria-label="End date"
          type="date"
          value={filters.endDate}
          onChange={(event) => setFilters((current) => nextLogFilters(current, { endDate: event.target.value }))}
        />
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table className="log-table">
        <thead>
          <tr><th>Time</th><th>Status</th><th>Name</th><th>NIM</th><th>Similarity</th><th>Description</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.timestamp}</td>
              <td>{row.status}</td>
              <td>{row.matched_name}</td>
              <td>{row.current_nim ?? '—'}</td>
              <td>{Math.round(row.similarity * 100)}%</td>
              <td>{row.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>Page {filters.page} / {pages}</span>
        <button type="button" disabled={filters.page >= pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>
    </section>
  )
}
