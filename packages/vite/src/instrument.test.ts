import { describe, expect, it } from 'vitest'
import { instrumentVueSfc } from './instrument.js'

const source = `<script setup lang="ts">
const canOrder = false
const stock = 0
const member = { active: true }
const price = 1200
</script>

<template>
  <button :disabled="!canOrder">Order</button>
  <span>{{ price }}</span>
  <button :disabled="stock === 0 || !member.active">Check</button>
  <div :class="{ soldout: stock === 0 }">Status</div>
</template>`

describe('instrumentVueSfc', () => {
  const instrument = () =>
    instrumentVueSfc(source, {
      filename: '/workspace/src/OrderButton.vue',
      root: '/workspace',
      enabled: true
    })!

  it('uses Vue compiler AST metadata for attributes and interpolations', () => {
    const result = instrument()

    expect(result.bindings).toHaveLength(4)
    expect(result.bindings.map((binding) => binding.expression)).toEqual([
      '!canOrder',
      'price',
      'stock === 0 || !member.active',
      '{ soldout: stock === 0 }'
    ])
    expect(result.bindings[2].dependencies).toEqual(['member.active', 'stock'])
    expect(result.bindings[1]).toMatchObject({ bindingType: 'text', bindingName: null })
    expect(result.bindings[0]).toMatchObject({ file: 'src/OrderButton.vue', line: 9 })
  })

  it('adds compact DOM IDs and registers metadata outside script setup', () => {
    const result = instrument()

    expect(result.code).toContain('data-whythis-id="wt-el-')
    expect(result.code).toContain("from '@whythis/vue'")
    expect(result.code).toContain('<script lang="ts">')
  })

  it('keeps IDs in opening tags and registers inside a normal script block', () => {
    const normalScriptSource = `<script lang="ts">
const label = 'Ready'
</script>

<template>
  <input :placeholder="label" />
  <p>{{ label }}</p>
</template>`
    const result = instrumentVueSfc(normalScriptSource, {
      filename: '/workspace/src/NormalScript.vue',
      root: '/workspace',
      enabled: true
    })!

    expect(result.code).toContain('<input :placeholder="label"  data-whythis-id="wt-el-')
    expect(result.code).toContain('data-whythis-id="wt-el-')
    expect(result.code).not.toContain('</p data-whythis-id')
    expect(result.code).toContain("const label = 'Ready'\n\nimport { registerMetadata")
    expect(result.code).toContain("__WHYTHIS_registerMetadata(")
    expect(result.code).toContain("\n</script>")
  })

  it('uses stable source IDs', () => {
    expect(instrument().bindings.map((binding) => binding.id)).toEqual(
      instrument().bindings.map((binding) => binding.id)
    )
  })

  it('does not instrument production mode', () => {
    expect(
      instrumentVueSfc(source, {
        filename: '/workspace/src/OrderButton.vue',
        root: '/workspace',
        enabled: false
      })
    ).toBeNull()
  })
})
