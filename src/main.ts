import './style.css'
import { TrailCapture, pointerToPose } from './capture'
import { paintHorizon } from './horizon'
import { copyText, isSecure } from './lib/clipboard'
import { formatCallsign, seedFromTrail, type Seed } from './lib/seed'
import { levelPose, type Orientation } from './lib/trail'
import {
  listenSensors,
  needsOrientationPermission,
  orientationSupported,
  requestSensors,
  type SensorHandle,
} from './sensors'

const caseEl = document.querySelector<HTMLElement>('#case')!
const statusEl = document.querySelector<HTMLElement>('#status')!
const lampEl = document.querySelector<HTMLElement>('#lamp')!
const gyro = document.querySelector<HTMLCanvasElement>('#gyro')!
const holdBtn = document.querySelector<HTMLButtonElement>('#hold')!
const holdWord = document.querySelector<HTMLElement>('#hold-word')!
const holdMeter = document.querySelector<HTMLElement>('#hold-meter')!
const plate = document.querySelector<HTMLElement>('#plate')!
const addressEl = document.querySelector<HTMLElement>('#address')!
const chipsEl = document.querySelector<HTMLElement>('#chips')!
const crumb = document.querySelector<HTMLElement>('#crumb')!
const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!
const enableBtn = document.querySelector<HTMLButtonElement>('#enable')!
const modeBtn = document.querySelector<HTMLButtonElement>('#mode')!

const capture = new TrailCapture()
let pose: Orientation = levelPose()
let mode: 'virtual' | 'sensor' = 'virtual'
let sensors: SensorHandle | null = null
let seed: Seed | null = null
let developing = false
let dragging = false
let copyReset = 0
const liveTrail: Orientation[] = []

function setStatus(text: string): void {
  statusEl.textContent = text
}

function setWord(text: string): void {
  holdWord.textContent = text
}

function setLamp(text: string, live = false): void {
  lampEl.textContent = text
  lampEl.classList.toggle('is-live', live)
}

function showPlate(next: Seed): void {
  seed = next
  caseEl.classList.add('is-ready')
  plate.hidden = false
  addressEl.textContent = formatCallsign(next.address)
  chipsEl.replaceChildren(
    ...next.chips.map((chip) => {
      const el = document.createElement('span')
      el.className = 'chip'
      el.textContent = chip
      return el
    }),
  )
  const via = mode === 'sensor' ? 'gyro' : 'horizon'
  crumb.textContent = next.still
    ? `still hold · ${via} · ${next.hashHex.slice(0, 8)}`
    : `${next.samples} poses · ${via} · ${next.hashHex.slice(0, 8)}`
  setStatus(next.still ? 'callsign from a still hold' : 'callsign on the plate')
  setWord('hold again')
  holdMeter.textContent = ''
}

function clearPlate(): void {
  seed = null
  caseEl.classList.remove('is-ready')
  plate.hidden = true
  addressEl.textContent = ''
  chipsEl.replaceChildren()
  crumb.textContent = ''
}

async function develop(samples: Orientation[]): Promise<void> {
  developing = true
  setWord('developing')
  setStatus('hashing the trail')
  holdMeter.textContent = ''
  try {
    showPlate(await seedFromTrail(samples))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'could not hash that trail')
    setWord('hold to seed')
  } finally {
    developing = false
  }
}

function applyPose(next: Orientation, from: 'virtual' | 'sensor'): void {
  if (from === 'sensor' && dragging) return
  pose = next
  liveTrail.push(next)
  if (liveTrail.length > 80) liveTrail.shift()
}

function beginHold(): void {
  if (developing || capture.holding || holdBtn.disabled) return
  clearPlate()
  capture.start(() => endHold())
  caseEl.classList.add('is-live')
  holdBtn.setAttribute('aria-pressed', 'true')
  setWord('capturing')
  setStatus('release to hash')
  capture.push(pose)
}

function endHold(): void {
  if (!capture.holding) return
  caseEl.classList.remove('is-live')
  holdBtn.setAttribute('aria-pressed', 'false')
  const samples = capture.stop()
  if (!samples) {
    setWord('hold to seed')
    setStatus('no trail — hold a little longer')
    return
  }
  void develop(samples)
}

function bindHold(): void {
  const onDown = (event: PointerEvent) => {
    if (holdBtn.disabled || event.button !== 0) return
    event.preventDefault()
    holdBtn.setPointerCapture(event.pointerId)
    beginHold()
  }
  const onUp = (event: PointerEvent) => {
    if (!holdBtn.hasPointerCapture(event.pointerId) && !capture.holding) return
    event.preventDefault()
    if (holdBtn.hasPointerCapture(event.pointerId)) {
      holdBtn.releasePointerCapture(event.pointerId)
    }
    endHold()
  }
  holdBtn.addEventListener('pointerdown', onDown)
  holdBtn.addEventListener('pointerup', onUp)
  holdBtn.addEventListener('pointercancel', onUp)
  holdBtn.addEventListener('lostpointercapture', () => {
    if (capture.holding) endHold()
  })
  holdBtn.addEventListener('contextmenu', (event) => event.preventDefault())

  const spaceTarget = (target: EventTarget | null) =>
    target === document.body || target === document.documentElement || target === holdBtn

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || !spaceTarget(event.target)) return
    event.preventDefault()
    beginHold()
  })
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return
    event.preventDefault()
    endHold()
  })
}

function bindHorizon(): void {
  const fromEvent = (event: PointerEvent): Orientation =>
    pointerToPose(event.clientX, event.clientY, gyro.getBoundingClientRect())

  gyro.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (mode === 'sensor') return
    event.preventDefault()
    dragging = true
    gyro.setPointerCapture(event.pointerId)
    gyro.classList.add('is-drag')
    applyPose(fromEvent(event), 'virtual')
  })
  gyro.addEventListener('pointermove', (event) => {
    if (!dragging) return
    applyPose(fromEvent(event), 'virtual')
  })
  const endDrag = (event: PointerEvent) => {
    if (!dragging) return
    if (gyro.hasPointerCapture(event.pointerId)) {
      gyro.releasePointerCapture(event.pointerId)
    }
    dragging = false
    gyro.classList.remove('is-drag')
  }
  gyro.addEventListener('pointerup', endDrag)
  gyro.addEventListener('pointercancel', endDrag)

  window.addEventListener('keydown', (event) => {
    if (mode === 'sensor') return
    const step = event.shiftKey ? 6 : 2
    if (event.key === 'ArrowLeft') pose = { ...pose, gamma: Math.max(-90, pose.gamma - step) }
    else if (event.key === 'ArrowRight') pose = { ...pose, gamma: Math.min(90, pose.gamma + step) }
    else if (event.key === 'ArrowUp') pose = { ...pose, beta: Math.min(90, pose.beta + step) }
    else if (event.key === 'ArrowDown') pose = { ...pose, beta: Math.max(-90, pose.beta - step) }
    else return
    event.preventDefault()
    applyPose(pose, 'virtual')
  })
}

function setMode(next: 'virtual' | 'sensor'): void {
  mode = next
  caseEl.dataset.mode = next
  modeBtn.hidden = next === 'virtual'
  if (next === 'sensor') {
    setLamp('gyro', true)
    setStatus('tilt the glass — hold to seed')
    gyro.setAttribute('aria-label', 'Attitude indicator following the device')
  } else {
    setLamp('virtual')
    setStatus('drag the horizon — or hold to seed')
    gyro.setAttribute('aria-label', 'Virtual horizon. Drag to tilt.')
  }
}

async function enableSensors(): Promise<void> {
  if (!isSecure()) {
    setStatus('insecure context — drag the horizon instead')
    return
  }
  try {
    const perm = await requestSensors()
    if (perm !== 'granted') {
      setStatus('sensors denied — drag the horizon')
      setMode('virtual')
      return
    }
    sensors?.stop()
    sensors = listenSensors(
      (next) => applyPose(next, 'sensor'),
      () => setMode('sensor'),
    )
    enableBtn.hidden = true
    setStatus('waiting for the gyro…')
  } catch {
    setStatus('sensors failed — drag the horizon')
    setMode('virtual')
  }
}

function bindChrome(): void {
  copyBtn.addEventListener('click', async () => {
    if (!seed) return
    const ok = await copyText(seed.address)
    copyBtn.textContent = ok ? 'copied' : 'copy failed'
    window.clearTimeout(copyReset)
    copyReset = window.setTimeout(() => {
      copyBtn.textContent = 'copy address'
    }, 1400)
  })
  againBtn.addEventListener('click', () => {
    clearPlate()
    setWord('hold to seed')
    setStatus(mode === 'sensor' ? 'tilt the glass' : 'drag the horizon')
  })
  enableBtn.addEventListener('click', () => {
    void enableSensors()
  })
  modeBtn.addEventListener('click', () => {
    sensors?.stop()
    sensors = null
    setMode('virtual')
    enableBtn.hidden = !orientationSupported()
  })
}

function loop(): void {
  if (capture.holding) capture.push(pose)
  const trail = capture.holding ? capture.samples : liveTrail
  paintHorizon(gyro, {
    pose,
    trail,
    holding: capture.holding,
    live: mode === 'sensor',
  })
  if (capture.holding) {
    holdMeter.textContent = `${Math.min(2, capture.elapsedSec).toFixed(1)}s`
  }
  requestAnimationFrame(loop)
}

function boot(): void {
  bindHold()
  bindHorizon()
  bindChrome()
  setMode('virtual')
  requestAnimationFrame(loop)

  if (!isSecure()) {
    setStatus('insecure context — drag the horizon')
    enableBtn.hidden = true
    return
  }

  if (needsOrientationPermission()) {
    enableBtn.hidden = false
    enableBtn.textContent = 'enable sensors'
    setStatus('on iOS, enable sensors — or drag the horizon')
    return
  }

  if (orientationSupported()) {
    enableBtn.hidden = false
    enableBtn.textContent = 'use device tilt'
    sensors = listenSensors((next) => {
      applyPose(next, 'sensor')
      if (mode === 'virtual' && !dragging && Math.hypot(next.beta, next.gamma) > 4) {
        enableBtn.hidden = true
        setMode('sensor')
      }
    })
  } else {
    enableBtn.hidden = true
  }
}

boot()
