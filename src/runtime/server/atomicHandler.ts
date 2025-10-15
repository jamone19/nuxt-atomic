
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { $fetch } from 'ofetch'
import { join } from 'pathe'
import { promises as fs } from 'node:fs'
import transactions from '#build/atomic/transactions.mjs'

type ApiCallDef = { method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, headers?: Record<string,string> }
type HydrateRef = { module: string, export?: string } | string
type StepDefinition = { key: string, execute: ApiCallDef, rollback: ApiCallDef, hydrate: HydrateRef }
type TransactionDefinition = { steps: StepDefinition[] }

type StepMode = 'put'|'get'|'noop'

function inferMode(step: StepDefinition): StepMode {
  // If user specified, honor it
  // @ts-ignore
  if (step.mode) return step.mode as StepMode
  const m = step.execute?.method?.toUpperCase?.()
  return m === 'GET' ? 'get' : 'put'
}


const LOG_LEVELS = ['info','error','warn'] as const
type Level = typeof LOG_LEVELS[number]

async function log(level: Level, logDir: string, payload: any) {
  const dir = join(process.cwd(), logDir || '.nuxt-atomic/logs')
  await fs.mkdir(dir, { recursive: true })
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...payload }) + '\n'
  await fs.appendFile(join(dir, 'atomic.log'), line, 'utf-8')
}

function templateUrl(url: string, vars: Record<string, any>) {
  return url.replace(/:([A-Za-z0-9_]+)/g, (_, k) => (vars?.[k] ?? `:${k}`))
}

async function loadHydrator(href: HydrateRef): Promise<(source:any, ctx:any) => any> {
  if (typeof href === 'string') {
    const mod = await import(/* @vite-ignore */ href)
    return (mod.hydrate ?? mod.default) as any
  }
  const { module, export: ex = 'hydrate' } = href
  const mod = await import(/* @vite-ignore */ module)
  return (mod[ex] ?? mod.default) as any
}

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') || event.path?.split('/').pop()
  const body = await readBody(event).catch(() => ({}))
  const runtime = useRuntimeConfig()
  // @ts-ignore
  const logDir = runtime.__atomic__?.logDir

  const txDef = (transactions as Record<string, TransactionDefinition>)[name || '']

  if (!name || !txDef) {
    await log('warn', logDir, { msg: 'Transaction not found', name, path: event.path })
    return { ok: false, error: `Unknown transaction: ${name}` }
  }

  const context = { event, name }
  const successes: { step: StepDefinition, result: any, vars: Record<string, any> }[] = []

  await log('info', logDir, { msg: 'Transaction start', name, steps: txDef.steps.map(s => s.key) })

  
// Execute steps sequentially with accumulators
const original = body || {}
let chainAcc: Record<string, any> = {}   // Accumulates ALL step results
let windowAcc: Record<string, any> = {}  // Accumulates GET results since last PUT

for (const step of txDef.steps) {
  const mode = inferMode(step)
  try {
    const hydrate = await loadHydrator(step.hydrate)
    // Compose input for this step's hydrator
    const composed = { ...original, ...chainAcc, ...(mode === 'put' ? windowAcc : {}) }
    const input = await hydrate(composed, { context, successes, chainAcc, windowAcc, mode })
    const url = templateUrl(step.execute.url, { ...input })
    await log('info', logDir, { msg: 'Step execute', name, step: step.key, url, method: step.execute.method, mode })

    const result = await $fetch(url, {
      method: step.execute.method,
      body: step.execute.method === 'GET' ? undefined : input,
      headers: step.execute.headers
    })

    successes.push({ step, result, vars: input })

    // Merge results into accumulators
    if (result && typeof result === 'object') {
      chainAcc = { ...chainAcc, ...result }
      if (mode === 'get') {
        windowAcc = { ...windowAcc, ...result }
      } else if (mode === 'put') {
        // After a PUT-like step, reset the GET window
        windowAcc = {}
      }
    }
  } catch (err: any) {
    await log('error', logDir, { msg: 'Step failed', name, step: step.key, error: err?.message || String(err) })

    // Rollback in reverse order
    const rollbackReports: Array<{ key: string, ok: boolean, error?: string }> = []
    for (const s of [...successes].reverse()) {
      try {
        const rbUrl = templateUrl(s.step.rollback.url, { ...(s.vars || {}), ...(s.result || {}) })
        await log('warn', logDir, { msg: 'Rollback execute', name, step: s.step.key, url: rbUrl, method: s.step.rollback.method })
        await $fetch(rbUrl, {
          method: s.step.rollback.method,
          body: s.step.rollback.method === 'GET' ? undefined : s.vars,
          headers: s.step.rollback.headers
        })
        rollbackReports.push({ key: s.step.key, ok: true })
      } catch (rbErr: any) {
        rollbackReports.push({ key: s.step.key, ok: false, error: rbErr?.message || String(rbErr) })
        await log('error', logDir, { msg: 'Rollback failed', name, step: s.step.key, error: rbErr?.message || String(rbErr) })
      }
    }

    return {
      ok: false,
      transaction: name,
      failedStep: step.key,
      error: err?.message || String(err),
      rollback: rollbackReports
    }
  }
}

await log('info', logDir, { msg: 'Transaction success', name })
return {
  ok: true,
  transaction: name,
  results: successes.map(s => ({ step: s.step.key, result: s.result }))
}
await log('info', logDir, { msg: 'Transaction success', name })
  return {
    ok: true,
    transaction: name,
    results: successes.map(s => ({ step: s.step.key, result: s.result }))
  }
})
