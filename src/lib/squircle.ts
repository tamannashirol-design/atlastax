// Continuous ("squircle") rounded rectangles as SVG paths, so corners curve
// smoothly into the edges instead of meeting them abruptly (like iOS icons).
// Same radius values as our tokens; `smoothing` (0–1) controls how far the
// curve extends along each edge. Algorithm after the open "figma-squircle" method.

const rad = (deg: number) => (deg * Math.PI) / 180

function corner(r: number, smoothing: number, budget: number) {
  let s = smoothing
  let p = (1 + s) * r
  if (p > budget) {
    s = Math.max(Math.min(budget / r - 1, s), 0)
    p = Math.min(p, budget)
  }
  const arcMeasure = 90 * (1 - s)
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2
  const alpha = (90 - arcMeasure) / 2
  const p3p4 = r * Math.tan(rad(alpha / 2))
  const beta = 45 * s
  const c = p3p4 * Math.cos(rad(beta))
  const d = c * Math.tan(rad(beta))
  const b = (p - arc - c - d) / 3
  const a = 2 * b
  return { a, b, c, d, p, arc, r }
}

const n = (v: number) => +v.toFixed(3)

/** Path for a w×h squircle at (x, y) with corner radius r (per corner optional). */
export function squircle(x: number, y: number, w: number, h: number, r: number | [number, number, number, number], smoothing = 0.6) {
  const [rtl, rtr, rbr, rbl] = typeof r === 'number' ? [r, r, r, r] : r
  const budget = Math.min(w, h) / 2
  const tr = corner(rtr, smoothing, budget)
  const br = corner(rbr, smoothing, budget)
  const bl = corner(rbl, smoothing, budget)
  const tl = corner(rtl, smoothing, budget)
  const part = (k: ReturnType<typeof corner>, sx: number, sy: number, swap: boolean) => {
    // one corner, drawn as cubic + arc + cubic, oriented by sign/swap
    const pt = (u: number, v: number) => (swap ? `${n(v * sx)} ${n(u * sy)}` : `${n(u * sx)} ${n(v * sy)}`)
    if (k.r === 0) return ''
    return `c ${pt(k.a, 0)} ${pt(k.a + k.b, 0)} ${pt(k.a + k.b + k.c, k.d)} a ${n(k.r)} ${n(k.r)} 0 0 1 ${pt(k.arc, k.arc)} c ${pt(k.d, k.c)} ${pt(k.d, k.b + k.c)} ${pt(k.d, k.a + k.b + k.c)}`
  }
  return [
    `M ${n(x + w - tr.p)} ${n(y)}`,
    part(tr, 1, 1, false),
    `L ${n(x + w)} ${n(y + h - br.p)}`,
    part(br, -1, 1, true),
    `L ${n(x + bl.p)} ${n(y + h)}`,
    part(bl, -1, -1, false),
    `L ${n(x)} ${n(y + tl.p)}`,
    part(tl, 1, -1, true),
    'Z',
  ].join(' ')
}
