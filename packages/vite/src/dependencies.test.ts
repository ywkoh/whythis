import { describe, expect, it } from 'vitest'
import { extractDependencies } from './dependencies.js'

describe('extractDependencies', () => {
  it('extracts a direct identifier', () => {
    expect(extractDependencies('!canOrder')).toEqual(['canOrder'])
  })

  it('preserves static member expressions', () => {
    expect(extractDependencies('stock === 0 || !member.active')).toEqual([
      'member.active',
      'stock'
    ])
  })

  it('includes computed property inputs without guessing their path', () => {
    expect(extractDependencies('inventory[activeSku].stock')).toEqual([
      'activeSku',
      'inventory'
    ])
  })

  it('does not treat inline function parameters as component dependencies', () => {
    expect(extractDependencies('items.filter(item => item.active && available)')).toEqual([
      'available',
      'items.filter'
    ])
  })
})
