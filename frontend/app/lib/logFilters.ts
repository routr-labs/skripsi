export type LogStatusFilter = '' | 'ALLOWED' | 'DENIED'

export type LogFilters = {
  q: string
  status: LogStatusFilter
  startDate: string
  endDate: string
  page: number
}

export const emptyLogFilters: LogFilters = {
  q: '',
  status: '',
  startDate: '',
  endDate: '',
  page: 1,
}

export function nextLogFilters(
  current: LogFilters,
  patch: Partial<Omit<LogFilters, 'page'>>,
): LogFilters {
  return { ...current, ...patch, page: 1 }
}
