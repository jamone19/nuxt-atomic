
export type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'

export interface ApiCallDef {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
}

export interface HydrateRef {
  module: string
  export?: string
}


export type StepMode = 'put' | 'get' | 'noop'

export interface StepDefinition {
  /** Logical mode of the step. Defaults to 'get' if HTTP method is GET, otherwise 'put'. */
  mode?: StepMode

  key: string
  execute: ApiCallDef
  rollback: ApiCallDef
  hydrate: HydrateRef | string
}

export interface TransactionDefinition {
  steps: StepDefinition[]
}
