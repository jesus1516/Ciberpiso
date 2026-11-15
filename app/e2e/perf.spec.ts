import { writeFileSync } from 'node:fs'
import { test, type CDPSession, type Page } from '@playwright/test'
import { FARMS, MUNICIPALITIES } from './helpers'

/**
 * Performance measurement (T-05). Not part of the normal suite: run it with
 *   npm run build && PERF=1 E2E_BROWSER=chromium npx playwright test perf
 * It throttles the CPU ×4 and the network to "Fast 3G" through the Chrome DevTools Protocol, then
 * walks Andalucía → Málaga → Antequera (29015, the largest municipality) → farm 2900059683 at the
 * normal animation speed. It records main-thread long tasks (PerformanceObserver), frame times
 * (requestAnimationFrame) per phase and the JS heap, prints a table and, with PERF_OUT=<file>,
 * writes the numbers as JSON.
 *
 * Headless runs render WebGL with SwiftShader (on the CPU), so frame times include software
 * rendering and are much worse than on a real GPU: compare runs with each other, not with a laptop.
 */
test.skip(!process.env.PERF, 'performance run: set PERF=1')
test.setTimeout(600_000)

const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const CPU = Number(process.env.PERF_CPU ?? 4)
/** DevTools "Fast 3G" preset: 562.5 ms RTT, 1.44 Mbit/s down, 675 kbit/s up. */
const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 }

type Phase = { name: string; ms: number; longTasks: number; longestTaskMs: number; totalBlockingMs: number; frames: number; longFrames: number; worstFrameMs: number; heapMB: number }

/** Installed before the app runs: long tasks and frame times, tagged with the phase they fall in. */
function probe() {
  const w = window as any
  w.__perf = { phase: 'boot', tasks: [] as { phase: string; start: number; dur: number }[], frames: [] as { phase: string; dur: number }[] }
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) w.__perf.tasks.push({ phase: w.__perf.phase, start: e.startTime, dur: e.duration })
  }).observe({ type: 'longtask', buffered: true })
  let last = performance.now()
  const tick = (t: number) => {
    w.__perf.frames.push({ phase: w.__perf.phase, dur: t - last })
    last = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function heapMB(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined)
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  return usedSize / 1024 / 1024
}

async function phase(page: Page, cdp: CDPSession, name: string, run: () => Promise<void>): Promise<Phase> {
  // PERF_PROFILE=<substring of a phase name>: also save a CPU profile of that phase (PERF_PROFILE_OUT).
  const profile = !!process.env.PERF_PROFILE && name.includes(process.env.PERF_PROFILE)
  if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start') }
  // Before the first navigation there is no probe yet: the probe tags the start-up as 'boot'.
  await page.evaluate((n) => { const p = (window as any).__perf; if (p) p.phase = n }, name)
  const t0 = Date.now()
  await run()
  const ms = Date.now() - t0
  // Let the last long task (e.g. tiling the farms after the camera stops) land in this phase.
  await page.waitForTimeout(1500)
  const { tasks, frames } = await page.evaluate((n) => {
    const p = (window as any).__perf
    const mine = (x: any) => x.phase === n || (n === 'Andalucía interactive' && x.phase === 'boot')
    return { tasks: p.tasks.filter(mine), frames: p.frames.filter(mine) }
  }, name)
  await page.evaluate(() => { (window as any).__perf.phase = 'idle' })
  if (profile) writeFileSync(process.env.PERF_PROFILE_OUT ?? 'perf.cpuprofile', JSON.stringify((await cdp.send('Profiler.stop')).profile))
  return {
    name,
    ms,
    longTasks: tasks.length,
    longestTaskMs: Math.round(Math.max(0, ...tasks.map((t: any) => t.dur))),
    totalBlockingMs: Math.round(tasks.reduce((s: number, t: any) => s + Math.max(0, t.dur - 50), 0)),
    frames: frames.length,
    longFrames: frames.filter((f: any) => f.dur > 50).length,
    worstFrameMs: Math.round(Math.max(0, ...frames.map((f: any) => f.dur))),
    heapMB: Math.round(await heapMB(cdp)),
  }
}

const settle = (page: Page, level: number) =>
  page.waitForFunction((l) => { const s = (window as any).__xp.state.getState(); return s.phase === 'idle' && s.level === l }, level, { timeout: 300_000, polling: 250 })

test('journey under CPU ×4 and Fast 3G', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', FAST_3G)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await page.setViewportSize({ width: 1440, height: 900 })
  // Map imagery and elevation come from third parties: answer them locally so only our own files
  // (bundle and data) go through the throttled network.
  await page.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG }))
  await page.addInitScript(probe)

  const phases: Phase[] = []
  phases.push(await phase(page, cdp, 'Andalucía interactive', async () => {
    await page.goto('/?director')
    await page.waitForFunction(() => (window as any).__xp?.state.getState().phase === 'idle', null, { timeout: 300_000, polling: 250 })
  }))
  // Give the background three.js download a chance, like a person reading the first screen.
  await page.waitForTimeout(3000)
  phases.push(await phase(page, cdp, 'Transition to Málaga', async () => {
    await page.evaluate(() => (window as any).__xp.ctrl.go(1))
    await settle(page, 1)
  }))
  phases.push(await phase(page, cdp, 'Open Antequera (29015)', async () => {
    await page.evaluate((m) => {
      const xp = (window as any).__xp
      xp.ctrl.go(2, { municipality: xp.ctrl.municipalities.features.find((f: any) => f.properties.mun === m).properties })
    }, MUNICIPALITIES.antequera)
    await settle(page, 2)
    await page.waitForFunction(() => (window as any).__xp.state.getState().farmsCount !== null, null, { timeout: 300_000, polling: 250 })
  }))
  // The farm detail is prefetched once the farms are on the map; a person takes a while to pick one.
  await page.waitForTimeout(3000)
  phases.push(await phase(page, cdp, `Open farm ${FARMS.antequera}`, async () => {
    await page.evaluate((id) => { const xp = (window as any).__xp; xp.ctrl.go(3, { farm: xp.getFarm(id) }) }, FARMS.antequera)
    await settle(page, 3)
  }))
  phases.push(await phase(page, cdp, 'Back to Antequera', async () => {
    await page.evaluate(() => (window as any).__xp.ctrl.go(2))
    await settle(page, 2)
  }))

  const head = ['phase', 'ms', 'long tasks', 'longest task', 'blocking', 'frames', '>50 ms', 'worst frame', 'heap MB']
  const rows = phases.map((p) => [p.name, p.ms, p.longTasks, p.longestTaskMs, p.totalBlockingMs, p.frames, p.longFrames, p.worstFrameMs, p.heapMB])
  console.log(`\nCPU ×${CPU}, Fast 3G\n| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`)
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify({ cpu: CPU, network: 'Fast 3G', phases }, null, 2))
})
