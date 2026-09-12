/** One pose on the orientation trail. Angles in degrees; accel in m/s². */
export type Orientation = {
  alpha: number
  beta: number
  gamma: number
  ax: number
  ay: number
  az: number
}

/** Fixed pose count so tempo does not change the hash — the path does. */
export const TARGET_SAMPLES = 48

/** Domain separator mixed into the digest. */
export const TRAIL_DOMAIN = 'tiltseed\n'

const SCALE_ANGLE = 10
const SCALE_ACCEL = 100

export function wrapDegrees(deg: number, period = 360): number {
  return ((deg % period) + period) % period
}

export function quantizeAngle(deg: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, deg))
  return Math.round(clamped * SCALE_ANGLE)
}

export function quantizeAccel(ms2: number): number {
  const n = Math.round(ms2 * SCALE_ACCEL)
  return Math.min(32767, Math.max(-32768, n))
}

export function levelPose(): Orientation {
  return { alpha: 0, beta: 0, gamma: 0, ax: 0, ay: 0, az: 0 }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPose(a: Orientation, b: Orientation, t: number): Orientation {
  return {
    alpha: lerp(a.alpha, b.alpha, t),
    beta: lerp(a.beta, b.beta, t),
    gamma: lerp(a.gamma, b.gamma, t),
    ax: lerp(a.ax, b.ax, t),
    ay: lerp(a.ay, b.ay, t),
    az: lerp(a.az, b.az, t),
  }
}

/** Unwrap yaw so resampling does not jump across 0/360. */
export function unwrapAlpha(samples: readonly Orientation[]): Orientation[] {
  if (samples.length === 0) return []
  const out = samples.map((s) => ({ ...s }))
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!
    const cur = out[i]!
    let d = cur.alpha - prev.alpha
    while (d > 180) {
      cur.alpha -= 360
      d -= 360
    }
    while (d < -180) {
      cur.alpha += 360
      d += 360
    }
  }
  return out
}

export function resampleTrail(
  samples: readonly Orientation[],
  count = TARGET_SAMPLES,
): Orientation[] {
  if (count < 1) return []
  if (samples.length === 0) return []
  if (samples.length === 1) {
    return Array.from({ length: count }, () => ({ ...samples[0]! }))
  }

  const unwrapped = unwrapAlpha(samples)
  const out: Orientation[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (unwrapped.length - 1)
    const i0 = Math.floor(t)
    const i1 = Math.min(unwrapped.length - 1, i0 + 1)
    const f = t - i0
    out.push(lerpPose(unwrapped[i0]!, unwrapped[i1]!, f))
  }
  return out
}

/** Little-endian int16 triples: α β γ ax ay az, 0.1° / 0.01 m/s². */
export function packTrail(samples: readonly Orientation[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 12)
  const view = new DataView(bytes.buffer)
  let o = 0
  for (const s of samples) {
    view.setInt16(o, quantizeAngle(wrapDegrees(s.alpha), 0, 360), true)
    o += 2
    view.setInt16(o, quantizeAngle(s.beta, -180, 180), true)
    o += 2
    view.setInt16(o, quantizeAngle(s.gamma, -90, 90), true)
    o += 2
    view.setInt16(o, quantizeAccel(s.ax), true)
    o += 2
    view.setInt16(o, quantizeAccel(s.ay), true)
    o += 2
    view.setInt16(o, quantizeAccel(s.az), true)
    o += 2
  }
  return bytes
}

export function normalizeTrail(samples: readonly Orientation[]): Uint8Array {
  if (samples.length === 0) {
    throw new Error('empty trail')
  }
  const resampled = resampleTrail(samples, TARGET_SAMPLES)
  const packed = packTrail(resampled)
  const domain = new TextEncoder().encode(TRAIL_DOMAIN)
  const out = new Uint8Array(domain.length + packed.length)
  out.set(domain, 0)
  out.set(packed, domain.length)
  return out
}

export function trailExtent(samples: readonly Orientation[]): number {
  if (samples.length === 0) return 0
  let minB = samples[0]!.beta
  let maxB = minB
  let minG = samples[0]!.gamma
  let maxG = minG
  for (const s of samples) {
    if (s.beta < minB) minB = s.beta
    if (s.beta > maxB) maxB = s.beta
    if (s.gamma < minG) minG = s.gamma
    if (s.gamma > maxG) maxG = s.gamma
  }
  return Math.hypot(maxB - minB, maxG - minG)
}
