import type { SelectionTrace } from '@whythis/core'
import { describe, expect, it } from 'vitest'
import { formatValue, traceAsMarkdown, traceAsText } from './trace.js'

describe('trace formatting', () => {
  it('does not recursively serialize arbitrary objects', () => {
    expect(formatValue({ token: 'do-not-display' })).toBe('[object]')
    expect(formatValue(['one', 'two'])).toBe('[Array(2)]')
  })

  it('keeps redacted dependency values out of both copy formats', () => {
    const trace: SelectionTrace = {
      selected: '<input>',
      component: null,
      source: null,
      bindings: [{
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
        dependencies: [{ path: 'accessToken', status: 'redacted' }],
        computed: [{
          name: 'accessToken',
          file: 'src/Login.vue',
          line: 1,
          references: [{ path: 'secretValue', status: 'redacted', value: 'do-not-copy' }]
        }],
        recentChanges: [{ path: 'accessToken', before: '[redacted]', after: '[redacted]', at: 0 }]
      }]
    }
    const output = traceAsText(trace)
    const markdown = traceAsMarkdown(trace)
    expect(output).toContain('Direct dependency: accessToken = [redacted]')
    expect(output).toContain('Getter source reference: secretValue = [redacted]')
    expect(output).not.toContain('do-not-copy')
    expect(markdown).toContain('secretValue = [redacted]')
    expect(markdown).not.toContain('do-not-copy')
  })

  it('labels template dependencies as direct', () => {
    const output = traceAsText({
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
          dependencies: [{ path: 'canOrder', status: 'available', value: false }],
          computed: [],
          recentChanges: []
        }
      ]
    })
    expect(output).toContain('Direct dependency: canOrder = false')
    expect(output).toContain('Location: src/OrderButton.vue:8')
  })
})
