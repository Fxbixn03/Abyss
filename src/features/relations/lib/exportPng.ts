import type { Rect } from '@xyflow/react'

/**
 * Renderer-side PNG export of the React Flow graph — no new dependency, no IPC.
 *
 * Browsers can't draw live DOM onto a canvas directly, so we take the standard
 * dependency-free route: clone the `.react-flow__viewport` (nodes + the edge
 * SVG), flatten every element's *computed* style inline (which resolves the
 * active theme's CSS-variable colours to concrete values), wrap the clone in an
 * SVG `<foreignObject>`, rasterise that SVG through an `Image`, and paint it
 * onto an off-screen canvas sized to the graph bounds. Finally `toBlob` →
 * a temporary `<a download>`.
 */

/** Padding (flow units) drawn around the graph bounds in the exported image. */
const PADDING = 48

/** Computed-style properties that matter for a faithful, self-contained clone. */
const COPIED_STYLE_PROPS = [
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'box-shadow',
  'opacity',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-overflow',
  'white-space',
  'overflow',
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'box-sizing',
] as const

/** Read a resolved CSS custom property off the document root. */
function resolvedVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

/** Copy the listed computed-style props from a live node onto its clone. */
function inlineComputedStyle(source: Element, clone: Element): void {
  const computed = getComputedStyle(source)
  const decls: string[] = []
  for (const prop of COPIED_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (value) decls.push(`${prop}:${value}`)
  }
  // Strip transforms on the viewport clone itself; pan/zoom is baked into the
  // SVG translate, so a residual transform would double-offset the content.
  clone.setAttribute('style', decls.join(';'))
}

/** Recursively flatten computed styles across a live tree and its clone. */
function inlineTree(source: Element, clone: Element): void {
  inlineComputedStyle(source, clone)
  const sourceChildren = source.children
  const cloneChildren = clone.children
  for (let i = 0; i < sourceChildren.length; i += 1) {
    const sc = sourceChildren[i]
    const cc = cloneChildren[i]
    if (sc && cc) inlineTree(sc, cc)
  }
}

/** Trigger a browser download for a blob via a throwaway anchor. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** `abyss-relations-<agentId>-<YYYY-MM-DD>.png` */
function exportFileName(agentId: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `abyss-relations-${agentId}-${today}.png`
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to rasterise relations graph'))
    }
    img.src = url
  })
}

export async function exportFlowToPng({
  bounds,
  agentId,
}: {
  bounds: Rect
  agentId: string
}): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) return

  const width = Math.ceil(bounds.width + PADDING * 2)
  const height = Math.ceil(bounds.height + PADDING * 2)
  if (width <= 0 || height <= 0) return

  // Clone the viewport (nodes + edges SVG) and bake in resolved styles so the
  // serialised markup is fully self-contained.
  const clone = viewport.cloneNode(true) as HTMLElement
  inlineTree(viewport, clone)
  // Shift the clone so the graph's top-left sits at (PADDING, PADDING) inside
  // the image, cancelling the live pan/zoom transform.
  clone.style.transform = `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px)`
  clone.style.transformOrigin = '0 0'

  const background = resolvedVar('--background', '#ffffff')
  const xmlns = 'http://www.w3.org/2000/svg'
  const cloneMarkup = new XMLSerializer().serializeToString(clone)
  const svg =
    `<svg xmlns="${xmlns}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${background}"/>` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">` +
    cloneMarkup +
    `</div>` +
    `</foreignObject>` +
    `</svg>`

  const image = await loadSvgImage(svg)

  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * dpr)
  canvas.height = Math.ceil(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  )
  if (!blob) return
  downloadBlob(blob, exportFileName(agentId))
}
