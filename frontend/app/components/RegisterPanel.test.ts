import { describe, expect, it } from 'vitest'

import { registrationButtonText } from './RegisterPanel'

describe('registrationButtonText', () => {
  it('shows the ready label when no matching registration action is busy', () => {
    expect(registrationButtonText('start', null)).toBe('Start registration')
    expect(registrationButtonText('capture', 'start')).toBe('Capture sample')
    expect(registrationButtonText('finalize', 'capture')).toBe('Finalize')
    expect(registrationButtonText('upload', 'finalize')).toBe('Register from uploads')
  })

  it('shows processing labels for the busy action', () => {
    expect(registrationButtonText('start', 'start')).toBe('Starting...')
    expect(registrationButtonText('capture', 'capture')).toBe('Capturing...')
    expect(registrationButtonText('finalize', 'finalize')).toBe('Saving...')
    expect(registrationButtonText('upload', 'upload')).toBe('Processing samples...')
  })
})
