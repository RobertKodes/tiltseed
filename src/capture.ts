import { levelPose, type Orientation } from './lib/trail'

const HOLD_MS = 2000
const MIN_SAMPLES = 6

export class TrailCapture {
  samples: Orientation[] = []
  holding = false
  startedAt = 0
  private timer = 0
  private onCeiling: (() => void) | null = null

  get elapsedSec(): number {
    if (!this.holding) return 0
    return (performance.now() - this.startedAt) / 1000
  }

  start(onCeiling: () => void): void {
    this.samples = []
    this.holding = true
    this.startedAt = performance.now()
    this.onCeiling = onCeiling
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      if (this.holding) this.onCeiling?.()
    }, HOLD_MS)
  }

  push(pose: Orientation): void {
    if (!this.holding) return
    this.samples.push({ ...pose })
  }

  stop(): Orientation[] | null {
    window.clearTimeout(this.timer)
    this.timer = 0
    this.holding = false
    this.onCeiling = null
    if (this.samples.length < MIN_SAMPLES) return null
    return this.samples.slice()
  }
}

export function pointerToPose(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): Orientation {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const nx = (clientX - cx) / Math.max(1, rect.width / 2)
  const ny = (clientY - cy) / Math.max(1, rect.height / 2)
  const dx = Math.max(-1, Math.min(1, nx))
  const dy = Math.max(-1, Math.min(1, ny))
  const gamma = dx * 90
  const beta = -dy * 90
  const alpha = (Math.atan2(dx, -dy) * 180) / Math.PI
  return {
    ...levelPose(),
    alpha: ((alpha % 360) + 360) % 360,
    beta,
    gamma,
  }
}
