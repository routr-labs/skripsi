import { describe, expect, it } from 'vitest'

import { emptyLogFilters, nextLogFilters } from './logFilters'

describe('nextLogFilters', () => {
  it('resets to page 1 when any filter changes', () => {
    const current = { ...emptyLogFilters, q: 'old', page: 4 }

    expect(nextLogFilters(current, { q: 'new' })).toEqual({
      ...emptyLogFilters,
      q: 'new',
      page: 1,
    })
  })
})
