import { describe, expect, it } from 'vitest'
import { formatValue, traceAsText } from './trace.js'

describe('trace formatting', () => {
  it('does not recursively serialize arbitrary objects', () => {
    expect(formatValue({ token: 'do-not-display' })).toBe('[object]')
    expect(formatValue(['one', 'two'])).toBe('[Array(2)]')
  })

  it('keeps redacted dependency values out of a console-copy trace', () => {
    expect(
      traceAsText({
        selected: '<input>',
        component: null,
        source: null,
        bindings: [
          {
            binding: {
              id: 'wt-token',
              elementId: 'wt-el-token',
              file: 'src/Login.vue',
              element: 'input',
              bindingType: 'attribute',
              bindingName: 'value',
              expression: 'accessToken',
              dependencies: ['accessToken'],
              line: 2
            },
            result: '[redacted]',
            dependencies: [{ path: 'accessToken', status: 'redacted' }]
          }
        ]
      })
    ).toContain('Direct dependency: accessToken = [redacted]')
  })

  it('labels template dependencies as direct', () => {
    expect(
      traceAsText({
        selected: '<button disabled>',
        component: 'OrderButton',
        source: 'src/OrderButton.vue',
        bindings: [
          {
            binding: {
              id: 'wt-a',
              elementId: 'wt-el-a',
              file: 'src/OrderButton.vue',
              element: 'button',
              bindingType: 'attribute',
              bindingName: 'disabled',
              expression: '!canOrder',
              dependencies: ['canOrder'],
              line: 8
            },
            result: true,
            dependencies: [{ path: 'canOrder', status: 'available', value: false }]
          }
        ]
      })
    ).toContain('Direct dependency: canOrder = false')
  })
})
