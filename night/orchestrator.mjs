#!/usr/bin/env node
// Night shift orchestrator.
//
// Runs the tickets in night/tickets/ with headless Claude Code agents, one fresh session per
// attempt, each in its own git worktree ("slot") on its own branch. A second agent verifies
// every result; approved tickets are merged into the integration branch, never into main.
// Usage limits pause the whole shift until the limit resets; the shift then resumes on its own.
//
//   node night/orchestrator.mjs            run until every ticket is done or blocked
//   node night/orchestrator.mjs --only T-00 run a single ticket (smoke test)
//
// State lives in night/state/ (ignored by git), logs in night/logs/.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statfsSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NIGHT = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(NIGHT, '..')
const CONFIG = JSON.parse(readFileSync(join(NIGHT, 'config.json'), 'utf8'))
const STATE_DIR = join(NIGHT, 'state')
const LOG_DIR = join(NIGHT, 'logs')
const STATE_FILE = join(STATE_DIR, 'state.json')
const SLOTS_DIR = resolve(ROOT, CONFIG.slotsDir)
const INTEGRATION_DIR = join(SLOTS_DIR, 'integration')
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
mkdirSync(STATE_DIR, { recursive: true })
mkdirSync(LOG_DIR, { recursive: true })

// ------------------------------------------------------------------ small helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toLocaleString('sv-SE') // local time, YYYY-MM-DD HH:MM:SS
function log(msg) {
  const line = `[${now()}] ${msg}`
  console.log(line)
  appendFileSync(join(LOG_DIR, 'orchestrator.log'), line + '\n')
}
function notify(title, body) {
  log(`NOTIFY ${title}: ${body}`)
  try {
    const esc = (s) => String(s).replace(/["\\]/g, ' ')
    execFileSync('osascript', ['-e', `display notification "${esc(body)}" with title "Ciberpiso night" subtitle "${esc(title)}" sound name "Glass"`])
  } catch { /* not on macOS or no GUI session */ }
  if (CONFIG.ntfyTopic) {
    fetch(`https://ntfy.sh/${CONFIG.ntfyTopic}`, { method: 'POST', body: `${title}: ${body}` }).catch(() => {})
  }
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function tryGit(cwd, ...args) {
  try { return { ok: true, out: git(cwd, ...args) } } catch (e) { return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` } }
}
function freeMB() {
  const s = statfsSync(ROOT)
  return (s.bavail * s.bsize) / 1e6
}
/** Runs a shell command with a timeout; resolves with { code, out } (never rejects). */
function run(cmd, args, { cwd, input, timeoutMin = 30, logFile } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } })
    let out = ''
    const add = (d) => {
      out += d
      if (logFile) appendFileSync(logFile, d)
    }
    child.stdout.on('data', add)
    child.stderr.on('data', add)
    const timer = setTimeout(() => {
      add(`\n[orchestrator] timeout after ${timeoutMin} min, killing\n`)
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 10000)
    }, timeoutMin * 60000)
    child.on('close', (code) => { clearTimeout(timer); resolveRun({ code: code ?? 1, out }) })
    child.on('error', (e) => { clearTimeout(timer); resolveRun({ code: 1, out: out + String(e) }) })
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
  })
}
// Non-login shell: keeps the PATH the shift was started with (node, npm, python with pytest).
const sh = (command, cwd, timeoutMin = 20) => run('/bin/bash', ['-c', command], { cwd, timeoutMin })

// ------------------------------------------------------------------ tickets and state
function parseTicket(file) {
  const text = readFileSync(file, 'utf8')
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error(`${file}: missing front matter`)
  const meta = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    const raw = line.slice(i + 1).trim()
    meta[key] = /^[[{0-9]/.test(raw) || raw === 'true' || raw === 'false' ? JSON.parse(raw) : raw
  }
  return { depends: [], files: [], checks: [], softChecks: [], maxAttempts: 2, timeoutMin: 90, effort: 'high', ...meta, body: m[2].trim(), file }
}
function loadTickets() {
  return readdirSync(join(NIGHT, 'tickets')).filter((f) => /^T-\d+.*\.md$/.test(f)).sort().map((f) => parseTicket(join(NIGHT, 'tickets', f)))
}
function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { tickets: {}, pauseUntil: 0, startedAt: now() }
}
const state = loadState()
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
const ticketState = (id) => (state.tickets[id] ??= { status: 'pending', attempts: 0, feedback: '', history: [] })

/** Glob ("app/src/**", "*.md") → RegExp, enough for the files: lists in tickets. */
function globToRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++ }
    else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
const allowed = (t, file) => file === `night/reports/${t.id}.md` || t.files.some((g) => globToRegex(g).test(file))
/** Two tickets may run together only if no file could belong to both. Approximate on prefixes. */
function overlaps(a, b) {
  const stem = (g) => g.split('*')[0]
  return a.files.some((x) => b.files.some((y) => stem(x).startsWith(stem(y)) || stem(y).startsWith(stem(x))))
}

// ------------------------------------------------------------------ git worktrees ("slots")
const SPARSE = ['/*', '!/data/andalucia/', '!/data/malaga/']
function ensureWorktree(dir, ref) {
  if (existsSync(join(dir, '.git'))) return
  mkdirSync(SLOTS_DIR, { recursive: true })
  git(ROOT, 'config', 'extensions.worktreeConfig', 'true')
  git(ROOT, 'worktree', 'add', '--no-checkout', '--detach', dir, ref)
  git(dir, 'sparse-checkout', 'set', '--no-cone', ...SPARSE)
  git(dir, 'checkout', '--detach', ref)
}
function ensureIntegration() {
  git(ROOT, 'fetch', 'origin', '--prune')
  const remote = tryGit(ROOT, 'rev-parse', '--verify', `origin/${CONFIG.integration}`).ok
  if (!remote) {
    git(ROOT, 'push', 'origin', `origin/${CONFIG.base}:refs/heads/${CONFIG.integration}`)
    git(ROOT, 'fetch', 'origin')
    log(`created ${CONFIG.integration} from ${CONFIG.base}`)
  }
  ensureWorktree(INTEGRATION_DIR, `origin/${CONFIG.integration}`)
  git(INTEGRATION_DIR, 'checkout', '-B', CONFIG.integration, `origin/${CONFIG.integration}`)
}
async function prepareSlot(slot, t, ts) {
  const dir = join(SLOTS_DIR, `slot-${slot}`)
  ensureWorktree(dir, `origin/${CONFIG.integration}`)
  git(dir, 'reset', '--hard')
  git(dir, 'clean', '-fd')
  git(dir, 'fetch', 'origin', '--prune')
  const branch = `night/${t.id}`
  // A branch can only be checked out in one worktree: free it if another slot still holds it.
  const holders = git(ROOT, 'worktree', 'list', '--porcelain').split('\n\n')
    .filter((b) => b.includes(`branch refs/heads/${branch}`)).map((b) => b.split('\n')[0].slice('worktree '.length))
  for (const h of holders) if (resolve(h) !== resolve(dir)) git(h, 'checkout', '--detach')
  const exists = tryGit(dir, 'rev-parse', '--verify', branch).ok
  // Resume an existing branch that already has work (retry, or a session cut by a restart).
  const hasWork = exists && git(dir, 'rev-list', '--count', `origin/${CONFIG.integration}..${branch}`) !== '0'
  if (exists && (ts.attempts > 0 || hasWork) && !ts.restart) {
    git(dir, 'checkout', branch)
    // Bring the branch up to date with what other tickets merged meanwhile.
    const merge = tryGit(dir, 'merge', '--no-edit', `origin/${CONFIG.integration}`)
    if (!merge.ok) {
      tryGit(dir, 'merge', '--abort')
      git(dir, 'checkout', '-B', branch, `origin/${CONFIG.integration}`)
      ts.feedback += '\nYour previous branch conflicted with the integration branch and was restarted from it.'
    }
  } else {
    git(dir, 'checkout', '-B', branch, `origin/${CONFIG.integration}`)
    ts.restart = false
  }
  // Changes are judged against the integration branch, not against where a retry resumed.
  ts.base = git(dir, 'merge-base', 'HEAD', `origin/${CONFIG.integration}`)
  // Dependencies: reinstall only when the lockfile changed.
  const lock = join(dir, 'app', 'package-lock.json')
  const marker = join(dir, 'app', 'node_modules', '.night-lock')
  const lockText = existsSync(lock) ? readFileSync(lock, 'utf8') : ''
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== String(lockText.length) + lockText.slice(0, 200)) {
    log(`${t.id}: npm ci in slot-${slot}`)
    const r = await sh('npm ci --no-audit --no-fund', join(dir, 'app'), 15)
    if (r.code !== 0) throw new Error(`npm ci failed: ${r.out.slice(-800)}`)
    writeFileSync(marker, String(lockText.length) + lockText.slice(0, 200))
  }
  return { dir, branch }
}

// ------------------------------------------------------------------ Claude sessions
const LIMIT_RE = /usage.?limit|rate.?limit|limit reached|hit your .{0,20}limit|limit will reset|overloaded|"api_error_status":(429|529)/i
/** Reset time from "...|1712345678" or "resets 4am" / "resets 4:30pm" (local time); 0 if unknown. */
function limitResetAt(text) {
  const epoch = text.match(/limit reached\|(\d{10})/)
  if (epoch) return Number(epoch[1]) * 1000
  const m = text.match(/resets (\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return 0
  const d = new Date()
  d.setHours((Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0), Number(m[2] ?? 0), 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  return d.getTime()
}
async function claude({ prompt, model, effort, cwd, timeoutMin, logFile, schema, readOnly = false }) {
  const args = ['-p', '--model', model, '--effort', effort, '--output-format', 'json',
    '--permission-mode', 'bypassPermissions',
    '--disallowedTools', 'Bash(git push:*)', 'Bash(gh:*)', 'Bash(sudo:*)', 'Bash(git checkout main:*)', 'Bash(git reset --hard origin:*)',
    ...(readOnly ? ['Edit', 'Write', 'NotebookEdit', 'Bash(git commit:*)', 'Bash(git add:*)', 'Bash(rm:*)'] : [])]
  if (schema) args.push('--json-schema', JSON.stringify(schema))
  writeFileSync(logFile, `# ${now()} model=${model}\n`)
  const { code, out } = await run('claude', args, { cwd, input: prompt, timeoutMin, logFile })
  let result = null
  try { result = JSON.parse(out.slice(out.indexOf('{'))) } catch { /* not JSON */ }
  const text = result?.result ?? out
  const limited = result?.api_error === 'usage_limit_reached' || [429, 529].includes(result?.api_error_status) ||
    ((code !== 0 || result?.is_error) && LIMIT_RE.test(text + out))
  return { code, result, text: String(text), limited, resetAt: limited ? limitResetAt(text + out) : 0, cost: result?.total_cost_usd ?? 0 }
}

/** Usage limit: pause everything until it resets (or until a cheap probe succeeds). */
async function waitForLimit(resetAt) {
  const until = Math.max(resetAt + 60000, Date.now() + CONFIG.limitProbeMinutes * 60000)
  if (state.pauseUntil > Date.now()) return
  state.pauseUntil = until
  saveState()
  notify('Usage limit reached', `Pausing until ~${new Date(until).toLocaleTimeString('es-ES')} and resuming automatically.`)
  const deadline = Date.now() + CONFIG.limitMaxWaitHours * 3600000
  while (Date.now() < deadline) {
    await sleep(Math.max(60000, state.pauseUntil - Date.now()))
    if (existsSync(join(NIGHT, 'STOP'))) return
    const probe = await run('claude', ['-p', '--model', 'haiku', '--output-format', 'json'], { cwd: ROOT, input: 'Reply with the single word OK.', timeoutMin: 5 })
    if (probe.code === 0 && !LIMIT_RE.test(probe.out)) {
      state.pauseUntil = 0
      saveState()
      notify('Resuming', 'The usage limit has reset; the night shift continues.')
      return
    }
    state.pauseUntil = Date.now() + CONFIG.limitProbeMinutes * 60000
    saveState()
    log(`limit still active, next probe at ${new Date(state.pauseUntil).toLocaleTimeString('es-ES')}`)
  }
}

// ------------------------------------------------------------------ prompts
const template = (name) => readFileSync(join(NIGHT, 'prompts', name), 'utf8')
function reportsIndex() {
  const dir = join(INTEGRATION_DIR, 'night', 'reports')
  if (!existsSync(dir)) return '(none yet)'
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.length ? files.map((f) => `- night/reports/${f}`).join('\n') : '(none yet)'
}
function workerPrompt(t, ts, slotDir) {
  return template('worker.md')
    .replaceAll('{{ID}}', t.id)
    .replaceAll('{{TITLE}}', t.title)
    .replaceAll('{{BRANCH}}', `night/${t.id}`)
    .replaceAll('{{FILES}}', t.files.map((f) => `- ${f}`).join('\n'))
    .replaceAll('{{CHECKS}}', [...CONFIG.checks, ...t.checks].map((c) => `- \`${c}\``).join('\n'))
    .replaceAll('{{SOFT_CHECKS}}', [...CONFIG.softChecks, ...t.softChecks].map((c) => `- \`${c}\``).join('\n'))
    .replaceAll('{{REPORTS}}', reportsIndex())
    .replaceAll('{{DATA_DIR}}', join(ROOT, 'data'))
    .replaceAll('{{SLOT}}', slotDir)
    .replaceAll('{{ATTEMPT}}', String(ts.attempts + 1))
    .replaceAll('{{FEEDBACK}}', ts.feedback ? ts.feedback.trim() : 'None: this is the first attempt.')
    .replaceAll('{{CONTRACT}}', t.body)
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: { approved: { type: 'boolean' }, summary: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['approved', 'summary', 'problems'],
}

// ------------------------------------------------------------------ one ticket
async function runChecks(t, dir, list) {
  const results = []
  for (const c of list) {
    const r = await sh(c, dir, 20)
    results.push({ cmd: c, ok: r.code === 0, tail: r.out.slice(-2500) })
  }
  return results
}
async function runTicket(t, slot) {
  const ts = ticketState(t.id)
  ts.status = 'running'
  ts.startedAt = now()
  saveState()
  const { dir, branch } = await prepareSlot(slot, t, ts)
  log(`${t.id}: attempt ${ts.attempts + 1}/${t.maxAttempts} on ${branch} in slot-${slot} (${t.model})`)

  // 1. Worker
  for (;;) {
    if (existsSync(join(NIGHT, 'STOP'))) { ts.status = 'pending'; saveState(); return }
    const w = await claude({ prompt: workerPrompt(t, ts, dir), model: t.model, effort: t.effort, cwd: dir, timeoutMin: t.timeoutMin, logFile: join(LOG_DIR, `${t.id}-a${ts.attempts + 1}-worker.log`) })
    ts.cost = (ts.cost ?? 0) + w.cost
    if (w.limited) { await waitForLimit(w.resetAt); continue }
    break
  }
  // Anything the agent left uncommitted is committed here, so nothing is lost.
  git(dir, 'add', '-A')
  if (tryGit(dir, 'diff', '--cached', '--quiet').ok === false) git(dir, 'commit', '-q', '-m', `chore(${t.id}): uncommitted work left by the agent`)

  // 2. Contract checks: files and commands
  const changed = git(dir, 'diff', '--name-only', `${ts.base}..HEAD`).split('\n').filter(Boolean)
  const outside = changed.filter((f) => !allowed(t, f))
  const hard = await runChecks(t, dir, [...CONFIG.checks, ...t.checks])
  const soft = await runChecks(t, dir, [...CONFIG.softChecks, ...t.softChecks])
  const hasReport = existsSync(join(dir, 'night', 'reports', `${t.id}.md`))
  const failures = [
    ...(changed.length ? [] : ['No changes were committed.']),
    ...(outside.length ? [`Files outside the contract were changed: ${outside.join(', ')}`] : []),
    ...(hasReport ? [] : [`Missing report night/reports/${t.id}.md`]),
    ...hard.filter((c) => !c.ok).map((c) => `Check failed: ${c.cmd}\n${c.tail}`),
  ]

  // 3. Verifier (only if the mechanical checks pass)
  let verdict = { approved: false, summary: 'Not reviewed: mechanical checks failed.', problems: failures }
  if (!failures.length) {
    const diff = git(dir, 'diff', `${ts.base}..HEAD`, '--', '.', ':(exclude)*.json', ':(exclude)*.geojson', ':(exclude)*lock*').slice(0, 90000)
    const prompt = template('verifier.md')
      .replaceAll('{{ID}}', t.id)
      .replaceAll('{{CONTRACT}}', t.body)
      .replaceAll('{{FILES}}', changed.join('\n'))
      .replaceAll('{{CHECKS}}', [...hard, ...soft].map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.cmd}\n${c.ok ? '' : c.tail}`).join('\n'))
      .replaceAll('{{REPORT}}', readFileSync(join(dir, 'night', 'reports', `${t.id}.md`), 'utf8'))
      .replaceAll('{{DIFF}}', diff)
    for (;;) {
      const v = await claude({ prompt, model: CONFIG.verifierModel, effort: 'medium', cwd: dir, timeoutMin: 30, logFile: join(LOG_DIR, `${t.id}-a${ts.attempts + 1}-verifier.log`), schema: VERDICT_SCHEMA, readOnly: true })
      ts.cost = (ts.cost ?? 0) + v.cost
      if (v.limited) { await waitForLimit(v.resetAt); continue }
      const so = v.result?.structured_output
      verdict = so && typeof so.approved === 'boolean' ? so : { approved: false, summary: 'Verifier output was not readable.', problems: [v.text.slice(0, 1500)] }
      break
    }
  }
  ts.attempts++
  ts.history.push({ at: now(), approved: verdict.approved, summary: verdict.summary, problems: verdict.problems })
  tryGit(dir, 'push', '-f', 'origin', `${branch}:${branch}`)

  // 4. Merge into the integration branch, or retry / block
  if (verdict.approved) {
    git(INTEGRATION_DIR, 'fetch', 'origin')
    git(INTEGRATION_DIR, 'checkout', '-B', CONFIG.integration, `origin/${CONFIG.integration}`)
    const m = tryGit(INTEGRATION_DIR, 'merge', '--no-ff', '-m', `Merge ${t.id}: ${t.title}`, `origin/${branch}`)
    if (m.ok) {
      git(INTEGRATION_DIR, 'push', 'origin', CONFIG.integration)
      ts.status = 'done'
      ts.finishedAt = now()
      notify(`${t.id} done`, `${t.title}. ${verdict.summary.slice(0, 120)}`)
    } else {
      tryGit(INTEGRATION_DIR, 'merge', '--abort')
      ts.feedback = 'Your branch was approved but conflicted when merging into the integration branch. Merge origin/night/integration into your branch, resolve the conflicts and re-run the checks.'
      ts.status = ts.attempts >= t.maxAttempts + 1 ? 'blocked' : 'pending'
    }
  } else {
    ts.feedback = `Previous attempt was not approved.\nVerifier: ${verdict.summary}\n${verdict.problems.map((p) => `- ${p}`).join('\n')}`
    ts.status = ts.attempts >= t.maxAttempts ? 'blocked' : 'pending'
    if (ts.status === 'blocked') notify(`${t.id} blocked`, verdict.summary.slice(0, 150))
  }
  ts.verdict = verdict
  saveState()
  log(`${t.id}: ${ts.status} — ${verdict.summary}`)
}

// ------------------------------------------------------------------ reporting
function statusTable(tickets) {
  const rows = tickets.map((t) => {
    const s = ticketState(t.id)
    return `| ${t.id} | ${t.title} | ${t.model} | ${s.status} | ${s.attempts} | ${(s.verdict?.summary ?? '').replace(/\|/g, '/').slice(0, 160)} |`
  })
  return ['| Ticket | Title | Model | Status | Attempts | Last verdict |', '|---|---|---|---|---|---|', ...rows].join('\n')
}
async function publishSummary(tickets, final) {
  const body = `# Night shift ${final ? 'summary' : 'progress'}\n\nStarted ${state.startedAt}, updated ${now()}.\n\n${statusTable(tickets)}\n\nEvery ticket has its own branch \`night/T-XX\` and report in \`night/reports/\`. Approved tickets are merged into \`${CONFIG.integration}\`; nothing is merged into \`${CONFIG.base}\` automatically.\n`
  writeFileSync(join(STATE_DIR, 'MORNING.md'), body)
  if (!final) return
  git(INTEGRATION_DIR, 'fetch', 'origin')
  git(INTEGRATION_DIR, 'checkout', '-B', CONFIG.integration, `origin/${CONFIG.integration}`)
  writeFileSync(join(INTEGRATION_DIR, 'night', 'MORNING.md'), body)
  git(INTEGRATION_DIR, 'add', 'night/MORNING.md')
  if (tryGit(INTEGRATION_DIR, 'diff', '--cached', '--quiet').ok === false) {
    git(INTEGRATION_DIR, 'commit', '-q', '-m', 'docs(night): morning summary')
    git(INTEGRATION_DIR, 'push', 'origin', CONFIG.integration)
  }
  // One draft PR integration → main for the team to review in the morning.
  const pr = await run('gh', ['pr', 'list', '--head', CONFIG.integration, '--json', 'number', '--jq', '.[0].number'], { cwd: ROOT, timeoutMin: 2 })
  const number = pr.out.trim()
  const args = number
    ? ['pr', 'edit', number, '--body', body]
    : ['pr', 'create', '--draft', '--base', CONFIG.base, '--head', CONFIG.integration, '--title', 'Night shift: integrated tickets', '--body', body]
  const r = await run('gh', args, { cwd: ROOT, timeoutMin: 2 })
  log(`PR: ${r.out.trim().slice(0, 200)}`)
}

// ------------------------------------------------------------------ main loop
async function main() {
  ensureIntegration()
  let tickets = loadTickets()
  if (ONLY) tickets = tickets.filter((t) => t.id === ONLY)
  // A restart (crash, reboot) leaves tickets marked as running: they go back to the queue.
  for (const t of tickets) if (ticketState(t.id).status === 'running') ticketState(t.id).status = 'pending'
  saveState()
  log(`night shift: ${tickets.length} tickets, ${CONFIG.slots} slots`)
  notify('Night shift started', `${tickets.length} tickets, ${CONFIG.slots} agents in parallel.`)
  const running = new Map() // slot → { t, promise }
  for (;;) {
    if (existsSync(join(NIGHT, 'STOP'))) {
      log('STOP file found: waiting for running tickets, then exiting')
      await Promise.all([...running.values()].map((r) => r.promise))
      notify('Night shift stopped', 'Stopped by night/STOP.')
      return 0
    }
    if (state.pauseUntil > Date.now()) { await sleep(30000); continue }
    if (freeMB() < CONFIG.minFreeMB) {
      notify('Low disk space', `Only ${Math.round(freeMB())} MB free; pausing new tickets.`)
      await sleep(10 * 60000)
      continue
    }
    const done = (id) => ticketState(id).status === 'done'
    const ready = tickets.filter((t) => {
      const s = ticketState(t.id)
      return s.status === 'pending' && t.depends.every(done) && ![...running.values()].some((r) => r.t.id === t.id || overlaps(r.t, t))
    })
    for (let slot = 1; slot <= CONFIG.slots && ready.length; slot++) {
      if (running.has(slot)) continue
      const t = ready.shift()
      const promise = runTicket(t, slot)
        .catch((e) => {
          const s = ticketState(t.id)
          s.status = (s.crashes = (s.crashes ?? 0) + 1) >= 3 ? 'blocked' : 'pending'
          s.feedback += `\nOrchestrator error: ${String(e.message).slice(0, 500)}`
          saveState()
          log(`${t.id}: orchestrator error ${e.stack}`)
          notify(`${t.id} error`, String(e.message).slice(0, 120))
        })
        .finally(() => {
          // Free the ticket branch so a retry can use it from any slot.
          tryGit(join(SLOTS_DIR, `slot-${slot}`), 'checkout', '--detach')
          running.delete(slot)
          publishSummary(tickets, false)
        })
      running.set(slot, { t, promise })
      await sleep(2000)
    }
    const open = tickets.filter((t) => ['pending', 'running'].includes(ticketState(t.id).status))
    if (!running.size && !open.length) break
    if (!running.size && !ready.length) {
      // Pending tickets whose dependencies are blocked can never run.
      log('no runnable tickets left (dependencies blocked)')
      break
    }
    await sleep(15000)
  }
  await publishSummary(tickets, true)
  const summary = tickets.map((t) => `${t.id}:${ticketState(t.id).status}`).join(' ')
  notify('Night shift finished', summary)
  return 0
}

main().then((code) => process.exit(code)).catch((e) => {
  log(`fatal: ${e.stack}`)
  notify('Orchestrator crashed', String(e.message).slice(0, 150))
  process.exit(1)
})
