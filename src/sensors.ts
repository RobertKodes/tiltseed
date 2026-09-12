import { levelPose, type Orientation } from './lib/trail'

type OrientationPermission = {
  requestPermission?: () => Promise<string>
}

export function needsOrientationPermission(): boolean {
  const DOE = DeviceOrientationEvent as unknown as OrientationPermission | undefined
  return typeof DeviceOrientationEvent !== 'undefined' && typeof DOE?.requestPermission === 'function'
}

export function orientationSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

export async function requestSensors(): Promise<'granted' | 'denied'> {
  const DOE = DeviceOrientationEvent as unknown as OrientationPermission
  const DME = DeviceMotionEvent as unknown as OrientationPermission
  if (typeof DOE.requestPermission === 'function') {
    const orient = await DOE.requestPermission()
    if (typeof DME.requestPermission === 'function') {
      await DME.requestPermission().catch(() => 'denied')
    }
    return orient === 'granted' ? 'granted' : 'denied'
  }
  return 'granted'
}

export type SensorHandle = {
  stop: () => void
}

export function listenSensors(
  onPose: (pose: Orientation) => void,
  onLive?: () => void,
): SensorHandle {
  let live = false
  const accel = { ax: 0, ay: 0, az: 0 }

  const onMotion = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity ?? event.acceleration
    if (!a) return
    accel.ax = a.x ?? 0
    accel.ay = a.y ?? 0
    accel.az = a.z ?? 0
  }

  const onOrient = (event: DeviceOrientationEvent) => {
    if (event.beta == null && event.gamma == null) return
    if (!live) {
      live = true
      onLive?.()
    }
    onPose({
      alpha: event.alpha ?? 0,
      beta: event.beta ?? 0,
      gamma: event.gamma ?? 0,
      ax: accel.ax,
      ay: accel.ay,
      az: accel.az,
    })
  }

  window.addEventListener('deviceorientation', onOrient)
  window.addEventListener('devicemotion', onMotion)

  return {
    stop() {
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('devicemotion', onMotion)
    },
  }
}

export { levelPose }
