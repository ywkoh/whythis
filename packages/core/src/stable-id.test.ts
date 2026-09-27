import { describe, expect, it } from 'vitest'
import { stableId } from './stable-id.js'

describe('stableId', () => {
  it('is deterministic and distinguishes source locations', () => {
    expect(stableId('wt', 'Button.vue:10:disabled')).toBe(
      stableId('wt', 'Button.vue:10:disabled')
    )
    expect(stableId('wt', 'Button.vue:10:disabled')).not.toBe(
      stableId('wt', 'Button.vue:11:disabled')
    )
  })
})
