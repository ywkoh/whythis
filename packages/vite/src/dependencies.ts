import { parse } from '@babel/parser'
import * as traverseModule from '@babel/traverse'
import type { NodePath } from '@babel/traverse'

// @babel/traverse is CommonJS. Accessing its explicit default keeps this ESM
// package compatible with NodeNext's strict CJS interop typing.
const traverse = traverseModule.default as unknown as (
  node: object,
  visitor: { Identifier(path: NodePath): void }
) => void

type MemberNode = {
  type: string
  object: unknown
  property: unknown
  computed: boolean
}

function isStaticMember(node: unknown): node is MemberNode {
  return Boolean(
    node &&
      typeof node === 'object' &&
      ((node as { type?: string }).type === 'MemberExpression' ||
        (node as { type?: string }).type === 'OptionalMemberExpression')
  )
}

function staticMemberPath(node: unknown): string | null {
  if ((node as { type?: string } | null)?.type === 'Identifier') {
    return (node as { name: string }).name
  }
  if (!isStaticMember(node) || node.computed) return null

  const object = staticMemberPath(node.object)
  const property = node.property as { type?: string; name?: string }
  return object && property.type === 'Identifier' && property.name
    ? `${object}.${property.name}`
    : null
}

function outerStaticMemberPath(path: NodePath): string | null {
  let cursor = path
  while (true) {
    const parent = cursor.parentPath
    if (!parent) break
    const node = parent.node as unknown as MemberNode
    const isMember = parent.isMemberExpression() || parent.isOptionalMemberExpression()
    if (!isMember || node.computed || node.object !== cursor.node) break
    cursor = parent
  }
  return staticMemberPath(cursor.node)
}

/**
 * Extracts only syntactically direct references from a JavaScript expression.
 * It intentionally does not attempt to infer computed implementation details.
 */
export function extractDependencies(expression: string): string[] {
  try {
    // Parentheses make object-literal bindings parse as expressions rather than
    // as a JavaScript block statement, while retaining normal lexical scopes.
    const ast = parse(`(${expression})`, {
      sourceType: 'module',
      plugins: ['typescript']
    })
    const dependencies = new Set<string>()

    traverse(ast, {
      Identifier(path: NodePath) {
        if (!path.isReferencedIdentifier()) return
        // Variables introduced by an inline arrow/function are not component state.
        if (path.scope.hasBinding(path.node.name, true)) return

        const parent = path.parentPath
        if (
          parent &&
          (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
          (parent.node as MemberNode).property === path.node &&
          !(parent.node as MemberNode).computed
        ) {
          return
        }

        dependencies.add(outerStaticMemberPath(path) ?? path.node.name)
      }
    })

    return [...dependencies].sort()
  } catch {
    // A malformed in-progress expression must never make a Vite transform fail.
    return []
  }
}
