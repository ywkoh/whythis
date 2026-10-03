import { describe, expect, it } from 'vitest'
import { recordChange, recentChanges } from './history.js'

describe('observed ref history', () => {
  it('keeps bounded, relevant changes for one component instance', () => {
    const instance = {}
    const anotherInstance = {}
    for (let value = 1; value <= 35; value += 1) {
      recordChange(instance, 'stock', value - 1, value)
    }
    recordChange(anotherInstance, 'stock', 0, 99)

    expect(recentChanges(instance, ['stock'], 40)).toHaveLength(30)
    expect(recentChanges(instance, ['stock'], 1)[0]).toMatchObject({
      path: 'stock', before: '34', after: '35'
    })
    expect(recentChanges(instance, ['price'])).toEqual([])
    expect(recentChanges(anotherInstance, ['stock'], 1)[0].after).toBe('99')
  })

  it('redacts sensitive paths before storing changes', () => {
    const instance = {}
    recordChange(instance, 'accessToken', 'old-secret', 'new-secret')
    expect(recentChanges(instance, ['accessToken'], 1)[0]).toMatchObject({
      before: '[redacted]', after: '[redacted]'
    })
  })
})
