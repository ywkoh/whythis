import { parse } from '@babel/parser'
import type { ComputedMetadata } from '@whythis/core'
import { extractDependencies } from './dependencies.js'

interface ScriptSource {
  content: string
  lang?: string
  loc: { start: { offset: number } }
}

export interface ComputedAnalysis {
  computed: ComputedMetadata[]
  trackableRefs: string[]
}

function lineAt(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1
  }
  return line
}

/** Finds named, top-level Composition API computed getters without changing them. */
export function analyzeComputedReferences(
  source: string,
  script: ScriptSource | null,
  file: string
): ComputedAnalysis {
  if (!script) return { computed: [], trackableRefs: [] }

  try {
    const ast = parse(script.content, {
      sourceType: 'module',
      plugins: script.lang === 'tsx' || script.lang === 'jsx'
        ? ['typescript', 'jsx']
        : ['typescript']
    })
    const importNames = new Map<string, string>()
    const stateNames = new Set<string>()
    const refLikeNames = new Set<string>()
    const trackableRefs = new Set<string>()

    for (const statement of ast.program.body) {
      if (statement.type === 'ImportDeclaration' && statement.source.value === 'vue') {
        for (const specifier of statement.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue
          const imported = specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
          importNames.set(specifier.local.name, imported)
        }
      }
      if (statement.type === 'VariableDeclaration') {
        for (const declaration of statement.declarations) {
          if (declaration.id.type === 'Identifier') stateNames.add(declaration.id.name)
        }
      }
    }

    for (const statement of ast.program.body) {
      if (statement.type !== 'VariableDeclaration') continue
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier' || declaration.init?.type !== 'CallExpression') continue
        const callee = declaration.init.callee
        if (callee.type !== 'Identifier') continue
        const imported = importNames.get(callee.name)
        if (['ref', 'shallowRef', 'customRef', 'toRef', 'computed'].includes(imported ?? '')) {
          refLikeNames.add(declaration.id.name)
        }
        if (imported === 'ref' || imported === 'shallowRef') {
          trackableRefs.add(declaration.id.name)
        }
      }
    }

    const computed: ComputedMetadata[] = []
    for (const statement of ast.program.body) {
      if (statement.type !== 'VariableDeclaration') continue
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier' || declaration.init?.type !== 'CallExpression') continue
        const call = declaration.init
        if (call.callee.type !== 'Identifier' || importNames.get(call.callee.name) !== 'computed') continue
        const getter = call.arguments[0]
        if (!getter || (getter.type !== 'ArrowFunctionExpression' && getter.type !== 'FunctionExpression')) continue
        if (getter.start == null || getter.end == null || declaration.start == null) continue

        const references = extractDependencies(script.content.slice(getter.start, getter.end))
          .filter((path) => stateNames.has(path.split('.')[0]))
          .map((path) => {
            const segments = path.split('.')
            return refLikeNames.has(segments[0]) && segments[1] === 'value'
              ? [segments[0], ...segments.slice(2)].join('.')
              : path
          })
        computed.push({
          name: declaration.id.name,
          file,
          line: lineAt(source, script.loc.start.offset + declaration.start),
          references: [...new Set(references)].sort()
        })
      }
    }
    return { computed, trackableRefs: [...trackableRefs].sort() }
  } catch {
    // In-progress or unsupported script syntax must not stop Vite transforms.
    return { computed: [], trackableRefs: [] }
  }
}
