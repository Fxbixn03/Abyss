/**
 * Unit tests for src/shared/lib/motion.ts (node:test).
 *
 * The module initialises a MediaQueryList at load time and caches the result.
 * We install a window.matchMedia stub on globalThis BEFORE requiring the
 * module (tsx compiles to CJS, so a dynamic require() after global setup
 * guarantees the initialiser sees the stub).
 *
 * No DOM, no React, no IPC — fully deterministic.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

type ChangeListener = (e: { matches: boolean }) => void

interface MockMql {
  matches: boolean
  listeners: ChangeListener[]
  addEventListener: (type: string, fn: ChangeListener) => void
  removeEventListener: (type: string, fn: ChangeListener) => void
  fire: (matches: boolean) => void
}

function makeMockMql(initialMatches: boolean): MockMql {
  const mql: MockMql = {
    matches: initialMatches,
    listeners: [],
    addEventListener(_type: string, fn: ChangeListener) {
      mql.listeners.push(fn)
    },
    removeEventListener(_type: string, fn: ChangeListener) {
      mql.listeners = mql.listeners.filter((l) => l !== fn)
    },
    fire(matches: boolean) {
      mql.matches = matches
      for (const fn of mql.listeners) {
        fn({ matches })
      }
    },
  }
  return mql
}

// ---------------------------------------------------------------------------
// Setup: install window stub then load the module
// ---------------------------------------------------------------------------

const mockMql = makeMockMql(false)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = {
  matchMedia: (_query: string) => mockMql,
}

// Resolve the compiled path (tsx rewrites @/ to src/ via tsconfig paths).
// We use the raw relative path so require() can find it after tsx transpiles.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const motionPath = resolve(__dirname, '../src/shared/lib/motion.ts')

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const motionModule: {
  getPrefersReducedMotion: () => boolean
  scrollBehavior: () => string
} = require(motionPath)

const { getPrefersReducedMotion, scrollBehavior } = motionModule

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('getPrefersReducedMotion: initial value is false when matchMedia reports no preference', () => {
  assert.equal(getPrefersReducedMotion(), false)
})

test('scrollBehavior: returns "smooth" when reduced motion is not preferred', () => {
  assert.equal(scrollBehavior(), 'smooth')
})

test('getPrefersReducedMotion: updates reactively when the OS setting changes to true', () => {
  mockMql.fire(true)
  assert.equal(getPrefersReducedMotion(), true)
})

test('scrollBehavior: returns "instant" after OS preference changes to reduced motion', () => {
  assert.equal(scrollBehavior(), 'instant')
})

test('getPrefersReducedMotion: updates reactively when the OS setting reverts to false', () => {
  mockMql.fire(false)
  assert.equal(getPrefersReducedMotion(), false)
})

test('scrollBehavior: returns "smooth" after OS preference reverts', () => {
  assert.equal(scrollBehavior(), 'smooth')
})
