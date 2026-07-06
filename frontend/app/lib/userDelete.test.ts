import { describe, expect, it } from 'vitest'

import { canDeleteUser } from './userDelete'

describe('canDeleteUser', () => {
  it('requires the exact NIM text', () => {
    expect(canDeleteUser('A001', 'A001')).toBe(true)
    expect(canDeleteUser(' a001 ', 'A001')).toBe(false)
    expect(canDeleteUser('Alice', 'A001')).toBe(false)
  })
})
