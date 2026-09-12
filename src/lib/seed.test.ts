import { describe, expect, it } from 'vitest'
import { chipsFromAddress, formatCallsign, seedFromTrail } from './seed'
import { levelPose, type Orientation } from './trail'

function pose(partial: Partial<Orientation>): Orientation {
  return { ...levelPose(), ...partial }
}

describe('seedFromTrail', () => {
  it('hashes the same trail to the same callsign', async () => {
    const trail = [pose({ alpha: 12, beta: -8, gamma: 4 }), pose({ alpha: 18, beta: 2, gamma: -6 })]
    const once = await seedFromTrail(trail)
    const twice = await seedFromTrail(trail)
    expect(once.address).toBe(twice.address)
    expect(once.hashHex).toBe(twice.hashHex)
    expect(once.address.length).toBeGreaterThanOrEqual(32)
    expect(once.address.length).toBeLessThanOrEqual(44)
    expect(once.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    expect(once.chips).toEqual(chipsFromAddress(once.address))
    expect(once.still).toBe(false)
  })

  it('changes when the trail changes', async () => {
    const a = await seedFromTrail([pose({ beta: 10 }), pose({ beta: -10 })])
    const b = await seedFromTrail([pose({ beta: -10 }), pose({ beta: 10 })])
    expect(a.address).not.toBe(b.address)
  })

  it('marks a still hold', async () => {
    const seed = await seedFromTrail([levelPose(), levelPose(), levelPose()])
    expect(seed.still).toBe(true)
    expect(seed.extent).toBe(0)
  })

  it('groups the callsign for the plate', async () => {
    const seed = await seedFromTrail([levelPose()])
    expect(formatCallsign(seed.address).includes(' ')).toBe(true)
  })

  it('locks a known still-level vector', async () => {
    const seed = await seedFromTrail([levelPose()])
    expect(seed.hashHex).toBe(
      'cf1d2290bf7db63055097271f35cc3ff67a4f7931788d787cef9ae3ebbcfd1c2',
    )
  })
})
