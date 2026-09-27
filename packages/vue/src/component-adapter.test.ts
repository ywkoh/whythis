import { describe, expect, it } from 'vitest'
import { readComponentPath, type VueInternalInstance } from './component-adapter.js'

describe('readComponentPath', () => {
  it('uses the public proxy for Options API/setup return values', () => {
    const component: VueInternalInstance = { proxy: { member: { active: true } } }
    expect(readComponentPath(component, 'member.active')).toEqual({ found: true, value: true })
  })

  it('uses the isolated internal setupState fallback for script setup bindings', () => {
    const component: VueInternalInstance = { setupState: { canOrder: false } }
    expect(readComponentPath(component, 'canOrder')).toEqual({ found: true, value: false })
  })

  it('does not invoke missing paths', () => {
    expect(readComponentPath({ proxy: {} }, 'missing.value')).toEqual({ found: false })
  })
})
