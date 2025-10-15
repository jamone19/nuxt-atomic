
# Functional Specification

## Goal
Provide an "atomic transaction" orchestration layer for Nuxt 4 APIs. Each transaction consists of ordered internal steps (external API calls or local actions). The handler executes steps sequentially and rolls back prior steps on failure. All activity is logged.

## Core Features
- Register transactions in `nuxt.config.ts` under the `atomic` key.
- Auto-create API routes at `{baseRoute}/:name` and `{baseRoute}/{Name}` for convenience.
- Step contract:
  - `execute: { method, url, headers? }`
  - `rollback: { method, url, headers? }`
  - `hydrate: (source, ctx) => payload`
- Execution:
  1. For each step, call `hydrate(source, ctx)` to translate the request body into the step payload.
  2. Execute the step via HTTP.
  3. On error, rollback successful steps in reverse order.
- Logging:
  - `atomic.log` in `.nuxt-atomic/logs/` with JSONL entries for starts, executions, errors, and rollbacks.
- Responses:
  - Success: `{ ok: true, results: [...] }`
  - Failure: `{ ok: false, failedStep, error, rollback: [...] }`

## Non-Goals
- Distributed transactions across databases (2PC/3PC).
- Idempotency keys (can be added by user).
- Persistent saga state storage (future enhancement).



## Step modes and data passing

Each step can declare a `mode`:
- `put` — a mutating step (default when `execute.method` is not GET). After a `put`, the **GET-window** resets.
- `get` — a read step (default when `execute.method` is GET). Its result is merged into the **GET-window**.
- `noop` — does nothing special with the window.

**Hydrate input composition**:
- For **get** steps: `{ ...originalPayload, ...chainAccumulator }`
- For **put** steps: `{ ...originalPayload, ...chainAccumulator, ...getWindowSinceLastPut }`

**Accumulators**:
- `chainAccumulator` merges results from **all** prior steps.
- `getWindowSinceLastPut` merges results from prior **get** steps since the last **put**, and resets after a **put**.



## Example: PUT → GET → GET → PUT

- **Step 1 (PUT)** `CreateInServiceA`: creates a user in Service A and returns `{ id, ... }`.
- **Step 2 (GET)** `FetchAProfile`: fetches a profile for `:id`. Result is added to the **GET-window**.
- **Step 3 (GET)** `FetchARecommendations`: fetches recommendations for `:id`. Also added to the **GET-window**.
- **Step 4 (PUT)** `CreateInServiceB`: receives `original + chainAcc + windowAcc`. This includes the `id` from Step 1 and the profile/recommendations from Steps 2–3. After this step, the **GET-window** is cleared.

Call it:
```bash
curl -X POST http://localhost:3000/api/atomic/CreateUserEverywhere   -H 'content-type: application/json'   -d '{"name":"Alicia","email":"alicia@example.com"}'
```
