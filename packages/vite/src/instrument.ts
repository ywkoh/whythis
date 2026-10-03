import {
  baseParse,
  ElementTypes,
  NodeTypes,
  type ElementNode,
  type TemplateChildNode
} from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { relative } from 'node:path'
import { stableId, type BindingMetadata, type ComputedMetadata } from '@whythis/core'
import { analyzeComputedReferences } from './computed-references.js'
import { extractDependencies } from './dependencies.js'

export interface InstrumentOptions {
  filename: string
  root: string
  enabled: boolean
}

interface InstrumentedElement {
  id: string
  startOffset: number
}

export interface InstrumentResult {
  code: string
  bindings: BindingMetadata[]
  computed: ComputedMetadata[]
}

function projectPath(filename: string, root: string): string {
  const path = relative(root, filename)
  return (path.startsWith('..') ? filename : path).replaceAll('\\', '/')
}

function lineAt(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1
  }
  return line
}

function findStartTagEnd(source: string, startOffset: number): number | null {
  let quote: '"' | "'" | '`' | null = null
  for (let index = startOffset; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
    } else if (character === '>') {
      return index
    }
  }
  return null
}

function appendRegistration(
  source: string,
  descriptor: ReturnType<typeof parse>['descriptor'],
  file: string,
  bindings: BindingMetadata[],
  computed: ComputedMetadata[]
): { offset: number; text: string } {
  const registration = [
    '',
    "import { registerMetadata as __WHYTHIS_registerMetadata } from '@whythis/vue'",
    `__WHYTHIS_registerMetadata(${JSON.stringify(file)}, ${JSON.stringify(bindings)}, ${JSON.stringify(computed)})`,
    ''
  ].join('\n')

  if (descriptor.script) {
    return {
      // Vue SFC block locations begin after the opening tag and end at the
      // opening `<` of the closing tag, so this is safely inside the script.
      offset: descriptor.script.loc.end.offset,
      text: registration
    }
  }

  const lang = descriptor.scriptSetup?.lang
  const langAttribute = lang ? ` lang="${lang}"` : ''
  return {
    offset: source.length,
    text: `\n<script${langAttribute}>${registration}</script>\n`
  }
}

function appendTracking(
  script: NonNullable<ReturnType<typeof parse>['descriptor']['scriptSetup']>,
  refNames: string[]
): { offset: number; text: string } {
  return {
    offset: script.loc.end.offset,
    text: [
      '',
      "import { trackRef as __WHYTHIS_trackRef } from '@whythis/vue'",
      ...refNames.map((name) => `__WHYTHIS_trackRef(${name}, ${JSON.stringify(name)})`),
      ''
    ].join('\n')
  }
}

function applyInsertions(source: string, insertions: { offset: number; text: string }[]): string {
  return [...insertions]
    .sort((a, b) => b.offset - a.offset)
    .reduce((result, insertion) => {
      return result.slice(0, insertion.offset) + insertion.text + result.slice(insertion.offset)
    }, source)
}

/**
 * Parses a Vue SFC using Vue compiler ASTs and injects only compact DOM IDs.
 * The full source metadata is registered by the development runtime.
 */
export function instrumentVueSfc(source: string, options: InstrumentOptions): InstrumentResult | null {
  if (!options.enabled) return null

  const parsed = parse(source, { filename: options.filename })
  const template = parsed.descriptor.template
  if (!template || parsed.errors.length > 0) return null

  let ast
  try {
    ast = baseParse(template.content)
  } catch {
    return null
  }

  // Vue SFC template locations start at template content, immediately after
  // the opening `<template>` tag.
  const contentOffset = template.loc.start.offset

  const file = projectPath(options.filename, options.root)
  const bindings: BindingMetadata[] = []
  const analysis = analyzeComputedReferences(source, parsed.descriptor.scriptSetup, file)
  const computed = analysis.computed
  const elements = new Map<number, InstrumentedElement>()

  const elementFor = (element: ElementNode): InstrumentedElement => {
    const startOffset = contentOffset + element.loc.start.offset
    const existing = elements.get(startOffset)
    if (existing) return existing
    const created = {
      id: stableId('wt-el', `${file}:${startOffset}`),
      startOffset
    }
    elements.set(startOffset, created)
    return created
  }

  const addBinding = (
    element: ElementNode,
    kind: BindingMetadata['bindingType'],
    name: string | null,
    expression: string,
    relativeOffset: number
  ): void => {
    const target = elementFor(element)
    const offset = contentOffset + relativeOffset
    bindings.push({
      id: stableId('wt', `${file}:${offset}:${kind}:${name ?? 'text'}`),
      elementId: target.id,
      file,
      element: element.tag,
      bindingType: kind,
      bindingName: name,
      expression,
      dependencies: extractDependencies(expression),
      line: lineAt(source, offset)
    })
  }

  const walk = (node: TemplateChildNode, owner: ElementNode | null): void => {
    if (node.type === NodeTypes.ELEMENT) {
      const element = node as ElementNode
      // Only native elements reliably result in a DOM node in this component.
      const nativeOwner = element.tagType === ElementTypes.ELEMENT ? element : null
      if (nativeOwner) {
        for (const property of element.props) {
          if (
            property.type === NodeTypes.DIRECTIVE &&
            property.name === 'bind' &&
            property.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
            property.arg.isStatic &&
            property.exp?.type === NodeTypes.SIMPLE_EXPRESSION
          ) {
            addBinding(
              element,
              'attribute',
              property.arg.content,
              property.exp.content,
              property.loc.start.offset
            )
          }
        }
      }
      for (const child of element.children) walk(child, nativeOwner)
      return
    }

    if (
      node.type === NodeTypes.INTERPOLATION &&
      owner &&
      node.content.type === NodeTypes.SIMPLE_EXPRESSION
    ) {
      addBinding(owner, 'text', null, node.content.content, node.loc.start.offset)
      return
    }

  }

  for (const child of ast.children) walk(child, null)
  if (bindings.length === 0) return null

  const insertions: { offset: number; text: string }[] = []
  for (const element of elements.values()) {
    const end = findStartTagEnd(source, element.startOffset)
    if (end !== null) {
      // Keep the slash at the end of a self-closing element (`<input />`).
      const offset = source[end - 1] === '/' ? end - 1 : end
      insertions.push({ offset, text: ` data-whythis-id="${element.id}"` })
    }
  }
  const relevantPaths = new Set([
    ...bindings.flatMap((binding) => binding.dependencies),
    ...computed.flatMap((entry) => entry.references)
  ])
  const trackedRefs = analysis.trackableRefs.filter((name) => relevantPaths.has(name))
  if (parsed.descriptor.scriptSetup && trackedRefs.length > 0) {
    insertions.push(appendTracking(parsed.descriptor.scriptSetup, trackedRefs))
  }
  insertions.push(appendRegistration(source, parsed.descriptor, file, bindings, computed))

  return { code: applyInsertions(source, insertions), bindings, computed }
}
