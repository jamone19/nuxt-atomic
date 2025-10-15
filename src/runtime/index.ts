
/**
 * Public runtime exports: types and helpers for creating hydrators with strong typing.
 */
export type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'

export interface ApiCallDef {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
}

export type StepMode = 'put'|'get'|'noop'

export interface HydrateContext<Source = any, Acc = Record<string, any>> {
  /** Internal execution context (Nuxt event, transaction name) */
  context: any
  /** Successful step records so far */
  successes: Array<{ step: any, result: any, vars: Record<string, any> }>
  /** Accumulates ALL step results */
  chainAcc: Acc
  /** Accumulates GET step results since last PUT */
  windowAcc: Acc
  /** Inferred or configured mode for this step */
  mode: StepMode
}

/** A strongly-typed Hydrator factory */
export function createHydrator<In extends Record<string, any>, Out extends Record<string, any>>(
  fn: (input: In, ctx: HydrateContext<In>) => Out | Promise<Out>
) {
  return fn
}

// Re-export internal types used by step definitions for convenience
export type { ApiCallDef as AtomicApiCallDef } from './types'
export type { StepDefinition as AtomicStepDefinition, TransactionDefinition as AtomicTransactionDefinition } from './types'
