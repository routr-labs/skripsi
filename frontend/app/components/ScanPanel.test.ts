import { describe, expect, it } from 'vitest'

import { scanFailureState } from './ScanPanel'

describe('scanFailureState', () => {
  it('clears stale result and maps no-hand errors to the static UI message', () => {
    expect(scanFailureState(new Error('No hand detected'), 'Scan failed')).toEqual({
      error: 'No hand detected — adjust position and try again',
      result: null,
      roiImage: '',
    })
  })

  it('keeps other scan error messages while clearing stale result', () => {
    expect(scanFailureState(new Error('Network error'), 'Scan failed')).toEqual({
      error: 'Network error',
      result: null,
      roiImage: '',
    })
  })
})
