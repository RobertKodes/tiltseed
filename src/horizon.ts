import { prefersReducedMotion } from './lib/clipboard'
import type { Orientation } from './lib/trail'

const SKY = '#3d6a78'
const SKY_DEEP = '#2a4e5a'
const EARTH = '#7a4e2e'
const EARTH_DEEP = '#4a2e1c'
const BRASS = '#d4b46a'
const BRASS_DARK = '#8a6a32'
const IVORY = '#f0e6d2'
const BUBBLE = '#c5edd4'
const TRAIL = '#e8c46a'

export type HorizonState = {
  pose: Orientation
  trail: Orientation[]
  holding: boolean
  live: boolean
}

export function paintHorizon(canvas: HTMLCanvasElement, state: HorizonState): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const css = canvas.clientWidth
  if (canvas.width !== Math.round(css * dpr) || canvas.height !== Math.round(css * dpr)) {
    canvas.width = Math.round(css * dpr)
    canvas.height = Math.round(css * dpr)
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, css, css)

  const cx = css / 2
  const cy = css / 2
  const r = css * 0.46
  const { beta, gamma } = state.pose
  const reduce = prefersReducedMotion()
  const roll = reduce ? 0 : (-gamma * Math.PI) / 180
  const pitchPx = reduce ? 0 : (-beta / 90) * (r * 0.72)

  drawBezel(ctx, cx, cy, r, state.holding)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx, cy)
  ctx.rotate(roll)
  ctx.translate(0, pitchPx)
  drawWorld(ctx, r)
  ctx.restore()

  drawTrail(ctx, cx, cy, r, state)
  drawWings(ctx, cx, cy, r)
  drawRollTicks(ctx, cx, cy, r, roll)
  drawBubble(ctx, cx, cy, r, state.pose, reduce)
}

function drawBezel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  holding: boolean,
): void {
  const outer = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy, r)
  outer.addColorStop(0, holding ? '#e8c46a' : '#e0c888')
  outer.addColorStop(0.45, BRASS)
  outer.addColorStop(1, BRASS_DARK)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = outer
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1410'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2)
  ctx.fillStyle = '#0e0c0a'
  ctx.fill()
}

function drawWorld(ctx: CanvasRenderingContext2D, r: number): void {
  const span = r * 3
  const sky = ctx.createLinearGradient(0, -span, 0, 0)
  sky.addColorStop(0, SKY_DEEP)
  sky.addColorStop(1, SKY)
  const earth = ctx.createLinearGradient(0, 0, 0, span)
  earth.addColorStop(0, EARTH)
  earth.addColorStop(1, EARTH_DEEP)

  ctx.fillStyle = sky
  ctx.fillRect(-span, -span, span * 2, span)
  ctx.fillStyle = earth
  ctx.fillRect(-span, 0, span * 2, span)

  ctx.strokeStyle = IVORY
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-span, 0)
  ctx.lineTo(span, 0)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(240, 230, 210, 0.55)'
  ctx.lineWidth = 1
  for (const deg of [-40, -20, 20, 40]) {
    const y = (deg / 90) * (r * 0.72)
    const w = Math.abs(deg) === 40 ? r * 0.22 : r * 0.34
    ctx.beginPath()
    ctx.moveTo(-w, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  state: HorizonState,
): void {
  if (state.trail.length < 2) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2)
  ctx.clip()
  ctx.beginPath()
  state.trail.forEach((pose, i) => {
    const x = cx + (pose.gamma / 90) * (r * 0.62)
    const y = cy + (-pose.beta / 90) * (r * 0.62)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = state.holding ? TRAIL : 'rgba(232, 196, 106, 0.35)'
  ctx.lineWidth = state.holding ? 2.2 : 1.2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawWings(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save()
  ctx.strokeStyle = IVORY
  ctx.fillStyle = IVORY
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.38, cy)
  ctx.lineTo(cx - r * 0.1, cy)
  ctx.moveTo(cx + r * 0.1, cy)
  ctx.lineTo(cx + r * 0.38, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy + r * 0.12)
  ctx.stroke()
  ctx.restore()
}

function drawRollTicks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  roll: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(roll)
  ctx.strokeStyle = BRASS
  ctx.fillStyle = BRASS
  ctx.lineWidth = 1.4
  for (const deg of [-60, -30, 0, 30, 60]) {
    const a = ((-deg) * Math.PI) / 180 - Math.PI / 2
    const inner = r * 0.84
    const outer = deg === 0 ? r * 0.94 : r * 0.91
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.84)
  ctx.lineTo(-5, -r * 0.74)
  ctx.lineTo(5, -r * 0.74)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pose: Orientation,
  reduce: boolean,
): void {
  const bx = cx
  const by = cy + r * 0.58
  const well = r * 0.16
  ctx.beginPath()
  ctx.arc(bx, by, well, 0, Math.PI * 2)
  const vial = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, well)
  vial.addColorStop(0, '#2a4a3a')
  vial.addColorStop(1, '#14241c')
  ctx.fillStyle = vial
  ctx.fill()
  ctx.strokeStyle = 'rgba(212, 180, 106, 0.55)'
  ctx.lineWidth = 1
  ctx.stroke()

  const ox = reduce ? 0 : (-pose.gamma / 90) * (well * 0.48)
  const oy = reduce ? 0 : (pose.beta / 90) * (well * 0.48)
  ctx.beginPath()
  ctx.arc(bx + ox, by + oy, well * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = BUBBLE
  ctx.globalAlpha = 0.88
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(bx + ox - 2, by + oy - 2, well * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.fill()
}
