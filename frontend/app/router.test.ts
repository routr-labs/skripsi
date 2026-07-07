import { describe, expect, it } from 'vitest'

import { getRouter } from './router'

describe('getRouter', () => {
  it('configures a not-found component', () => {
    expect(getRouter().options.defaultNotFoundComponent).toBeTypeOf('function')
  })
})
