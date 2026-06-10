/**
 * Relation-graph unit tests (node:test). Pure functions only — no disk, no
 * Electron. Covers edge detection (structured vs heuristic, code-fence
 * stripping, dedupe, stoplist, no self-edges) and cycle breaking.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detectEdges, type RelationScanInput } from '@core/relations'
import { breakCycles } from '@/features/relations/lib/breakCycles'
import { neighbors, reachableFrom } from '@/features/relations/lib/reachable'
import type {
  RelationEdge,
  RelationNode,
  RelationNodeKind,
} from '@/shared/types/relations'

function node(
  kind: RelationNodeKind,
  itemId: string,
  label = itemId,
): RelationNode {
  return { id: `${kind}:${itemId}`, kind, itemId, label, editable: false }
}

function input(n: RelationNode, content: string): RelationScanInput {
  return { node: n, content }
}

function find(
  edges: RelationEdge[],
  source: string,
  target: string,
): RelationEdge[] {
  return edges.filter((e) => e.source === source && e.target === target)
}

const FENCE = '```'

test('detectEdges: structured signals (subagent_type, mcp__, /command, tools)', () => {
  const src = node('subagent', 'orchestrator')
  const edges = detectEdges([
    input(
      src,
      [
        '---',
        'name: orchestrator',
        'tools: Read, mcp__github__search',
        '---',
        'Delegate via `subagent_type: reviewer`.',
        'Then run /deploy.',
        'Also calls mcp__github__create_issue.',
      ].join('\n'),
    ),
    input(node('subagent', 'reviewer'), ''),
    input(node('command', 'deploy'), ''),
    input(node('mcp', 'github'), ''),
  ])

  const reviewer = find(edges, src.id, 'subagent:reviewer')
  assert.equal(reviewer.length, 1)
  assert.equal(reviewer[0].kind, 'invokes-agent')
  assert.equal(reviewer[0].confidence, 'structured')

  const deploy = find(edges, src.id, 'command:deploy')
  assert.equal(deploy[0]?.kind, 'invokes-command')
  assert.equal(deploy[0]?.confidence, 'structured')

  const github = find(edges, src.id, 'mcp:github')
  assert.equal(github[0]?.kind, 'uses-mcp')
  assert.equal(github[0]?.confidence, 'structured')
})

test('detectEdges: heuristic name mention in prose', () => {
  const src = node('command', 'wrapper')
  const edges = detectEdges([
    input(src, 'We apply the humanizer skill before finishing.'),
    input(node('skill', 'humanizer'), ''),
  ])
  const e = find(edges, src.id, 'skill:humanizer')
  assert.equal(e.length, 1)
  assert.equal(e[0].kind, 'uses-skill')
  assert.equal(e[0].confidence, 'heuristic')
})

test('detectEdges: mentions inside fenced code blocks are ignored', () => {
  const src = node('command', 'demo')
  const edges = detectEdges([
    input(
      src,
      [
        'Here is an example:',
        '',
        `${FENCE}md`,
        'use the humanizer skill',
        FENCE,
        '',
        '~~~',
        'humanizer',
        '~~~',
      ].join('\n'),
    ),
    input(node('skill', 'humanizer'), ''),
  ])
  assert.equal(find(edges, src.id, 'skill:humanizer').length, 0)
})

test('detectEdges: inline code and frontmatter description ARE scanned', () => {
  const fromInline = node('command', 'demo')
  const inlineEdges = detectEdges([
    input(fromInline, 'We run the `humanizer` skill before finishing.'),
    input(node('skill', 'humanizer'), ''),
  ])
  assert.equal(find(inlineEdges, fromInline.id, 'skill:humanizer').length, 1)

  const fromDesc = node('command', 'feature-request')
  const descEdges = detectEdges([
    input(
      fromDesc,
      [
        '---',
        'name: feature-request',
        'description: Hands off directly to the feature-orchestrator.',
        '---',
        'Body without the mention.',
      ].join('\n'),
    ),
    input(node('skill', 'feature-orchestrator'), ''),
  ])
  const e = find(descEdges, fromDesc.id, 'skill:feature-orchestrator')
  assert.equal(e.length, 1)
  assert.equal(e[0].confidence, 'heuristic')
})

test('detectEdges: dedupe keeps the structured edge over the heuristic one', () => {
  const src = node('subagent', 'ci')
  const edges = detectEdges([
    input(src, 'Run /deploy then deploy again.'),
    input(node('command', 'deploy'), ''),
  ])
  const e = find(edges, src.id, 'command:deploy')
  assert.equal(e.length, 1)
  assert.equal(e[0].confidence, 'structured')
})

test('detectEdges: no self-edges', () => {
  const deploy = node('command', 'deploy')
  const edges = detectEdges([input(deploy, 'Invoke /deploy from inside itself.')])
  assert.equal(find(edges, deploy.id, deploy.id).length, 0)
})

test('detectEdges: stoplisted and too-short tokens are skipped (heuristic)', () => {
  const src = node('subagent', 'runner')
  const edges = detectEdges([
    input(src, "Run the test, then review, and finally go."),
    input(node('skill', 'test'), ''),
    input(node('command', 'review'), ''),
    input(node('skill', 'go'), ''),
  ])
  assert.equal(find(edges, src.id, 'skill:test').length, 0)
  assert.equal(find(edges, src.id, 'command:review').length, 0)
  assert.equal(find(edges, src.id, 'skill:go').length, 0)
})

// --- breakCycles -----------------------------------------------------------

function edge(source: string, target: string): RelationEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    kind: 'invokes-agent',
    confidence: 'structured',
  }
}

test('breakCycles: removes exactly one back-edge from a 2-cycle', () => {
  const a = 'subagent:a'
  const b = 'subagent:b'
  const edges = [edge(a, b), edge(b, a)]
  const result = breakCycles([a, b], edges)
  assert.equal(result.length, 1)
  assert.equal(result[0].id, `${a}->${b}`)
})

test('breakCycles: leaves an acyclic graph unchanged', () => {
  const edges = [edge('subagent:a', 'subagent:b'), edge('subagent:a', 'skill:c')]
  const result = breakCycles(['subagent:a', 'subagent:b', 'skill:c'], edges)
  assert.equal(result, edges)
})

// --- reachableFrom ---------------------------------------------------------

function ownsEdge(target: string): RelationEdge {
  return {
    id: `owns:${target}`,
    source: 'agent:hub',
    target,
    kind: 'owns',
    confidence: 'structured',
  }
}

test('reachableFrom: follows the transitive chain, ignores owns edges, handles cycles', () => {
  // hub owns everything; command:a → skill:b → subagent:c → subagent:c2,
  // plus a cycle c ↔ c2; an unrelated skill:z is owned but unreachable.
  const edges: RelationEdge[] = [
    ownsEdge('command:a'),
    ownsEdge('skill:b'),
    ownsEdge('subagent:c'),
    ownsEdge('subagent:c2'),
    ownsEdge('skill:z'),
    edge('command:a', 'skill:b'),
    edge('skill:b', 'subagent:c'),
    edge('subagent:c', 'subagent:c2'),
    edge('subagent:c2', 'subagent:c'),
  ]
  const reached = reachableFrom('command:a', edges)
  assert.deepEqual(
    [...reached].sort(),
    ['command:a', 'skill:b', 'subagent:c', 'subagent:c2'].sort(),
  )
  // The hub itself is not pulled in via owns edges.
  assert.ok(!reached.has('agent:hub'))
  assert.ok(!reached.has('skill:z'))
})

test('neighbors: direct in- and out-neighbours only, ignoring owns', () => {
  const edges: RelationEdge[] = [
    ownsEdge('skill:b'),
    edge('command:a', 'skill:b'),
    edge('skill:b', 'subagent:c'),
    edge('subagent:x', 'skill:b'),
  ]
  // skill:b's neighbours: a (incoming), c (outgoing), x (incoming) — not the hub.
  assert.deepEqual(
    [...neighbors('skill:b', edges)].sort(),
    ['command:a', 'skill:b', 'subagent:c', 'subagent:x'].sort(),
  )
})
