import { describe, expect, it } from 'vitest'
import {
  TARGET_SAMPLES,
  TRAIL_DOMAIN,
  levelPose,
  normalizeTrail,
  packTrail,
  quantizeAngle,
  resampleTrail,
  trailExtent,
  unwrapAlpha,
  wrapDegrees,
  type Orientation,
} from './trail'

function pose(partial: Partial<Orientation>): Orientation {
  return { ...levelPose(), ...partial }
}

describe('wrapDegrees', () => {
  it('folds yaw into [0, 360)', () => {
    expect(wrapDegrees(-10)).toBe(350)
    expect(wrapDegrees(370)).toBe(10)
    expect(wrapDegrees(0)).toBe(0)
  })
})

describe('quantizeAngle', () => {
  it('rounds to a tenth of a degree', () => {
    expect(quantizeAngle(12.34, -180, 180)).toBe(123)
    expect(quantizeAngle(12.36, -180, 180)).toBe(124)
  })

  it('clamps gamma to ±90', () => {
    expect(quantizeAngle(120, -90, 90)).toBe(900)
    expect(quantizeAngle(-120, -90, 90)).toBe(-900)
  })
})

describe('resampleTrail', () => {
  it('emits a fixed pose count', () => {
    const samples = [pose({ beta: 0 }), pose({ beta: 20 }), pose({ beta: 40 })]
    expect(resampleTrail(samples).length).toBe(TARGET_SAMPLES)
  })

  it('repeats a single pose', () => {
    const one = [pose({ gamma: -12 })]
    const out = resampleTrail(one, 4)
    expect(out).toHaveLength(4)
    expect(out.every((s) => s.gamma === -12)).toBe(true)
  })

  it('interpolates endpoints', () => {
    const out = resampleTrail([pose({ beta: 0 }), pose({ beta: 10 })], 3)
    expect(out[0]?.beta).toBeCloseTo(0)
    expect(out[1]?.beta).toBeCloseTo(5)
    expect(out[2]?.beta).toBeCloseTo(10)
  })
})

describe('unwrapAlpha', () => {
  it('crosses 0 without a 360 jump', () => {
    const out = unwrapAlpha([pose({ alpha: 350 }), pose({ alpha: 10 })])
    expect(out[1]?.alpha).toBeCloseTo(370)
  })
})

describe('packTrail', () => {
  it('writes 12 bytes per pose', () => {
    const bytes = packTrail([pose({ alpha: 90, beta: -5, gamma: 2 })])
    expect(bytes.byteLength).toBe(12)
    const view = new DataView(bytes.buffer)
    expect(view.getInt16(0, true)).toBe(900)
    expect(view.getInt16(2, true)).toBe(-50)
    expect(view.getInt16(4, true)).toBe(20)
  })
})

describe('normalizeTrail', () => {
  it('rejects an empty trail', () => {
    expect(() => normalizeTrail([])).toThrow(/empty trail/)
  })

  it('prefixes the domain and a fixed window', () => {
    const bytes = normalizeTrail([levelPose()])
    const domain = new TextEncoder().encode(TRAIL_DOMAIN)
    expect(bytes.slice(0, domain.length)).toEqual(domain)
    expect(bytes.byteLength).toBe(domain.length + TARGET_SAMPLES * 12)
  })

  it('is stable for the same path at different tempos', () => {
    const slow = [pose({ beta: 0 }), pose({ beta: 8 }), pose({ beta: 16 })]
    const fast = [
      pose({ beta: 0 }),
      pose({ beta: 4 }),
      pose({ beta: 8 }),
      pose({ beta: 12 }),
      pose({ beta: 16 }),
    ]
    expect(normalizeTrail(slow)).toEqual(normalizeTrail(fast))
  })

  it('changes when the path changes', () => {
    const a = normalizeTrail([pose({ gamma: 0 }), pose({ gamma: 20 })])
    const b = normalizeTrail([pose({ gamma: 0 }), pose({ gamma: -20 })])
    expect(a).not.toEqual(b)
  })
})

describe('trailExtent', () => {
  it('is zero for a still hold', () => {
    expect(trailExtent([levelPose(), levelPose()])).toBe(0)
  })

  it('grows with pitch/roll travel', () => {
    expect(trailExtent([pose({ beta: 0 }), pose({ beta: 10, gamma: 10 })])).toBeGreaterThan(10)
  })
})
