import { parse as parseSfc } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { analyzeComputedReferences } from './computed-references.js'

function references(script: string) {
  const source = `<script setup lang="ts">\n${script}\n</script>`
  const block = parseSfc(source).descriptor.scriptSetup
  return analyzeComputedReferences(source, block, 'src/OrderButton.vue')
}

describe('extractComputedReferences', () => {
  it('links a named Vue computed getter to top-level source references', () => {
    expect(references(`import { computed as derive, ref, reactive } from 'vue'
const stock = ref(0)
const member = reactive({ active: true })
const canOrder = derive(() => stock.value > 0 && member.active)`)).toEqual({ computed: [{
      name: 'canOrder',
      file: 'src/OrderButton.vue',
      line: 5,
      references: ['member.active', 'stock']
    }], trackableRefs: ['stock'] })
  })

  it('excludes getter locals, global names, and unrelated functions', () => {
    expect(references(`import { computed } from 'vue'
const stock = 1
const canOrder = computed(() => {
  const local = stock + 1
  return Boolean(local > 0)
})
const fake = otherComputed(() => stock > 0)`)).toEqual({ computed: [{
      name: 'canOrder',
      file: 'src/OrderButton.vue',
      line: 4,
      references: ['stock']
    }], trackableRefs: [] })
  })

  it('skips syntax it cannot safely understand', () => {
    expect(analyzeComputedReferences('bad source', {
      content: 'const canOrder = computed((',
      loc: { start: { offset: 0 } }
    }, 'src/OrderButton.vue')).toEqual({ computed: [], trackableRefs: [] })
  })
})
