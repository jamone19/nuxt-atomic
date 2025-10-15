
# Technical Documentation

## Architecture
- Nuxt module (`src/module.ts`) registers a generic server handler at `baseRoute` and specific handlers for each registered transaction name.
- Transactions are serialized into a build-time virtual module `#build/atomic/transactions.mjs`.
- The server handler (`runtime/server/atomicHandler.ts`) reads the request body, executes steps sequentially, logs activity, and orchestrates rollbacks.

## Data Contracts
```ts
type ApiCallDef = { method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, headers?: Record<string,string> }
type HydrateRef = { module: string, export?: string } | string
type StepDefinition = { key: string, execute: ApiCallDef, rollback: ApiCallDef, hydrate: HydrateRef }
type TransactionDefinition = { steps: StepDefinition[] }
```

## Hydrators
Hydrators are userland modules (server-side) that transform the transaction's source payload into the step payload.
- Specify via `hydrate: { module: '~/atomic/steps/userCreate', export: 'hydrateCreate' }`
- Or simply `hydrate: '~/atomic/steps/userCreate'` where the module exports `hydrate` or `default`.

The handler dynamically imports the module at runtime (`import(href)`), so the file must be resolvable by Node from the project root.

## URL Templating
`templateUrl()` replaces tokens like `:id` with variables from the hydrated payload or previous step results.

## Logging
- JSON lines file `.nuxt-atomic/logs/atomic.log`.
- Each line includes `ts`, `level`, and payload.

## Errors
- On step error, returns an object with `failedStep` and an array of rollback reports. Each report contains `{ key, ok, error? }`.

## Extensibility ideas
- Custom logger injection via module option.
- Idempotency keys and retry policies.
- Persistent saga state store.
- Concurrency controls.



### Modes and Accumulators

```ts
type StepMode = 'put' | 'get' | 'noop'
interface StepDefinition {
  key: string
  mode?: StepMode // default: GET -> 'get', otherwise 'put'
  execute: ApiCallDef
  rollback: ApiCallDef
  hydrate: HydrateRef | string
}
```
Runtime keeps two accumulators:
- `chainAcc`: merges every step result (useful for IDs from earlier puts).
- `windowAcc`: merges results of `get` steps since the last `put`. Hydrators for `put` receive `{ ...original, ...chainAcc, ...windowAcc }`; after a `put` completes, `windowAcc` is cleared.



## Typed hydrate helper

`@nuxt/nuxt-atomic/runtime` exposes:
```ts
export interface HydrateContext<Source = any, Acc = Record<string, any>> { /* ... */ }
export function createHydrator<In, Out>(
  fn: (input: In, ctx: HydrateContext<In>) => Out | Promise<Out>
): typeof fn
```
Use it to author hydrators with strong types and editor inference.
