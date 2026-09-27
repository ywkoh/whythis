import { describe, expect, it } from 'vitest'
import { BindingRegistry } from './registry.js'
import type { BindingMetadata } from './types.js'

const binding = (id: string, elementId: string): BindingMetadata => ({
  id,
  elementId,
  file: 'src/Button.vue',
  element: 'button',
  bindingType: 'attribute',
  bindingName: 'disabled',
  expression: '!canOrder',
  dependencies: ['canOrder'],
  line: 4
})

describe('BindingRegistry', () => {
  it('retrieves bindings by the DOM binding ID', () => {
    const registry = new BindingRegistry()
    registry.register('src/Button.vue', [binding('wt-a', 'wt-el-a')])

    expect(registry.get('wt-el-a')).toEqual([binding('wt-a', 'wt-el-a')])
  })

  it('replaces stale metadata for a HMR-updated file', () => {
    const registry = new BindingRegistry()
    registry.register('src/Button.vue', [binding('wt-a', 'wt-el-a')])
    registry.register('src/Button.vue', [binding('wt-b', 'wt-el-b')])

    expect(registry.get('wt-el-a')).toEqual([])
    expect(registry.get('wt-el-b')).toEqual([binding('wt-b', 'wt-el-b')])
  })
})
