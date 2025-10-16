// src/runtime/server/atomicHandler.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { $fetch } from 'ofetch'
import { join } from 'pathe'
import { promises as fs } from 'node:fs'
import { pathToFileURL } from 'node:url'

// ---- types ----
type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'
type ApiCallDef = { method: HttpMethod, url: string, headers?: Record<string,string> }
type HydrateRef = { module: string, export?: string } | string | ((src:any, ctx:any) => any)
type StepMode = 'put'|'get'|'noop'
type StepDefinition = { key: string, execute: ApiCallDef, rollback: ApiCallDef, hydrate: HydrateRef, mode?: StepMode }
type TransactionDefinition = { steps: StepDefinition[] }

// ---- utils ----
async function log(level: 'info'|'error'|'warn', logDir: string | undefined, payload: any) {
  const dir = join(process.cwd(), logDir || '.nuxt-atomic/logs')
  await fs.mkdir(dir, { recursive: true })
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...payload }) + '\n'
  await fs.appendFile(join(dir, 'atomic.log'), line, 'utf-8')
}

function templateUrl(url: string, vars: Record<string, any>) {
  return url.replace(/:([A-Za-z0-9_]+)/g, (_, k) => (vars?.[k] ?? `:${k}`))
}

function inferMode(step: StepDefinition): StepMode {
  if (step.mode) return step.mode
  const m = step.execute?.method?.toUpperCase?.()
  return m === 'GET' ? 'get' : 'put'
}

function toImportSpecifier(spec: string) {
  // Let Vite/Nuxt resolve aliases & virtual modules during bundle
  if (spec.startsWith('~/') || spec.startsWith('@/') || spec.startsWith('#')) {
    return { spec, vite: true }
  }
  // Absolute file path -> convert to file:// URL for Node
  if (spec.startsWith('/')) {
    return { spec: pathToFileURL(spec).href, vite: false }
  }
  // Relative file path -> resolve from project root
  const abs = join(process.cwd(), spec)
  return { spec: pathToFileURL(abs).href, vite: false }
}

async function loadHydrator(href: HydrateRef): Promise<(source:any, ctx:any) => any> {
  // If it’s already a function, use it directly.
  if (typeof href === 'function') return href

  // If it’s a string or { module, export }
  const modSpec = typeof href === 'string' ? href : href.module
  const ex = typeof href === 'string' ? 'hydrate' : (href.export || 'hydrate')

  const { spec, vite } = toImportSpecifier(modSpec)
  // Use /* @vite-ignore */ only for real file URLs. Aliases must go through normal import().
  const mod = vite ? await import(spec) : await import(/* @vite-ignore */ spec)
  const fn = (mod as any)[ex] ?? (mod as any).default
  if (typeof fn !== 'function') {
    throw new Error(`Hydrator export "${ex}" not found in ${modSpec}`)
  }
  return fn
}

// ---- factory ----
export function createAtomicHandler(transactions: Record<string, TransactionDefinition>) {
  return defineEventHandler(async (event) => {
    const name = getRouterParam(event, 'name') || event.path?.split('/').pop()
    const body = await readBody(event).catch(() => ({}))

    // Provided by Nitro at runtime
    // @ts-ignore
    const runtime = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {}
    // @ts-ignore
    const logDir = runtime.__atomic__?.logDir as string | undefined

    const txDef = (transactions as Record<string, TransactionDefinition>)[name || '']

    if (!name || !txDef) {
      await log('warn', logDir, { msg: 'Transaction not found', name, path: event.path })
      return { ok: false, error: `Unknown transaction: ${name}` }
    }

    const context = { event, name }
    const successes: { step: StepDefinition, result: any, vars: Record<string, any> }[] = []

    await log('info', logDir, { msg: 'Transaction start', name, steps: txDef.steps.map(s => s.key) })

    // accumulators
    const original = body || {}
    let chainAcc: Record<string, any> = {}
    let windowAcc: Record<string, any> = {}

    // Execute steps sequentially
    for (const step of txDef.steps) {
      const mode = inferMode(step)
      try {
        const hydrate = await loadHydrator(step.hydrate)
        const composed = { ...original, ...chainAcc, ...(mode === 'put' ? windowAcc : {}) }
        const input = await hydrate(composed, { context, successes, chainAcc, windowAcc, mode })
	// merge *all* known vars so :id can be filled from prior steps
        const varsForUrl = { ...chainAcc, ...windowAcc, ...(input || {}) }
        const url = templateUrl(step.execute.url, varsForUrl)

        await log('info', logDir, { msg: 'Step execute', name, step: step.key, url, method: step.execute.method, mode, vars: Object.keys(varsForUrl) })

        const result = await $fetch(url, {
          method: step.execute.method,
          body: step.execute.method === 'GET' ? undefined : input,
          headers: step.execute.headers
        })

        successes.push({ step, result, vars: input })

        // merge results
        if (result && typeof result === 'object') {
          chainAcc = { ...chainAcc, ...result }
          if (mode === 'get') windowAcc = { ...windowAcc, ...result }
          else if (mode === 'put') windowAcc = {}
        }
      } catch (err: any) {
        await log('error', logDir, { msg: 'Step failed', name, step: step.key, error: err?.message || String(err) })

        // Rollback in reverse order
        const rollbackReports: Array<{ key: string, ok: boolean, error?: string }> = []
        for (const s of [...successes].reverse()) {
          try {
	    // (also include accumulated values up to that point)
            const rbUrl = templateUrl(
              s.step.rollback.url,
              { ...(s.vars || {}), ...(s.result || {}), ...chainAcc } // safe, last write wins
            )
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
  })
}

