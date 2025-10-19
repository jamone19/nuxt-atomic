
<p align="center">
  <img src="./icons/nuxt-atomic-logo-horizontal.svg" width="640" alt="Nuxt Atomic" />
</p>

# @nuxt/nuxt-atomic

Atomic (saga-like) multi-step transactions for **Nuxt 4** with automatic server routes, typed hydrators, rollback orchestration, and structured logging.

Atomic brings a declarative transactional workflow to Nuxt, allowing your application to daisy chain API calls into Atomic Transactions

## Basics:
  register steps, 
  run, 
  rollback safely.

- Register a transaction → define ordered steps (`execute`, `rollback`, `hydrate`).
- Call `POST /api/atomic/<TransactionName>` → steps run sequentially; on failure, prior steps **roll back** in reverse.
- Pass data across steps: outputs accumulate (`chainAcc`) and **GET window** results join the next **PUT** input.
- Works with any package manager: `yarn add @nuxt/nuxt-atomic`, `pnpm add @nuxt/nuxt-atomic`, or `npm i @nuxt/nuxt-atomic`.

## Install

```bash
pnpm add @nuxt/nuxt-atomic
# or: yarn add @nuxt/nuxt-atomic
# or: npm i @nuxt/nuxt-atomic
```

## Quickstart

**nuxt.config.ts**

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/nuxt-atomic'],

  atomic: {
    baseRoute: '/api/atomic',            // optional (default '/api/atomic')
    logDir: '.nuxt-atomic/logs',         // optional
    // registryPath: '~/atomic/registry', // reserved/optional (current build inlines transactions)

    transactions: {
      CreateUser: {
        steps: [
          {
            key: 'CreateDBUser',
            execute:  { method: 'POST',   url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate:  { module: '~/atomic/steps/userCreate', export: 'hydrateCreate' }
          },
          {
            key: 'GrantWelcomeCredits',
            execute:  { method: 'POST', url: 'http://localhost:3001/mock/credits/grant' },
            rollback: { method: 'POST', url: 'http://localhost:3001/mock/credits/revoke' },
            hydrate:  { module: '~/atomic/steps/grantCredits', export: 'hydrate' }
          }
        ]
      },

      // Example of a chained flow: PUT → GET → GET → PUT
      CreateUserEverywhere: {
        steps: [
          {
            key: 'CreateInServiceA',
            execute:  { method: 'POST', url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate:  { module: '~/atomic/steps/createA', export: 'hydrate' }, // PUT
            mode: 'put'
          },
          {
            key: 'FetchAProfile',
            execute:  { method: 'GET', url: 'http://localhost:3001/mock/users/:id/profile' },
            rollback: { method: 'GET', url: 'http://localhost:3001/mock/nop' },
            hydrate:  { module: '~/atomic/steps/fetchAProfile', export: 'hydrate' }, // GET
            mode: 'get'
          },
          {
            key: 'FetchARecommendations',
            execute:  { method: 'GET', url: 'http://localhost:3001/mock/users/:id/recs' },
            rollback: { method: 'GET', url: 'http://localhost:3001/mock/nop' },
            hydrate:  { module: '~/atomic/steps/fetchARecs', export: 'hydrate' }, // GET
            mode: 'get'
          },
          {
            key: 'CreateInServiceB',
            execute:  { method: 'POST', url: 'http://localhost:3001/mock/usersB' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/usersB/:id' },
            hydrate:  { module: '~/atomic/steps/createB', export: 'hydrate' }, // PUT uses original + GET window
            mode: 'put'
          }
        ]
      }
    }
  }
})
```

**Step hydrator example** `~/atomic/steps/userCreate.ts`

```ts
import { createHydrator } from '@nuxt/nuxt-atomic/runtime'

type In  = { name: string; email: string; credits?: number } & Record<string, any>
type Out = { name: string; email: string }

export const hydrateCreate = createHydrator<In, Out>((input, ctx) => {
  return { name: input.name, email: input.email }
})
```

**Run**

```bash
pnpm -w build && pnpm demo
# curl
curl -sS -X POST http://localhost:3000/api/atomic/CreateUser   -H 'content-type: application/json'   -d '{"name":"Ada","email":"ada@lovelace.io","credits":50}' | jq
```

## E2E tests
```bash
pnpm -C examples/mock-server i
pnpm -C examples/nuxt-app i
pnpm test:e2e
```
The suite spawns the mock server and the Nuxt dev server, then calls the atomic routes. Coverage (V8) is emitted to `./coverage` and uploaded by CI as an artifact.

## Roadmap
We’re looking for collaborators & sponsors to help shape the roadmap. 

### Planned and proposed items:
- **Retries & backoff policies** (per-step and per-rollback; jitter, exponential)
- **Parallel / fan‑out steps** with fan‑in joins and data merge policies
- **Idempotency keys** and deduplication for execute & rollback
- **Persistence & recovery** (transaction store + resume/retry after crash/redeploy)
- **Observability** (OpenTelemetry traces, structured events, step timelines)
- **Circuit breakers & timeouts** (fail‑fast, trip conditions, half‑open recovery)
- **Conditional branches & guards** in the transaction DSL
- **Schema validation** for inputs/outputs (Zod) + typed codegen for hydrators
- **DevTools panel** to inspect live transactions, replay, and dry‑run
- **CLI** (inspect queue, force resume, retry/abort, dump timelines)
- **Pluggable sinks** for logs/metrics (stdout, file, HTTP, S3, Grafana/Loki)
- **Provider adapters** (Stripe, Supabase, Clerk, SendGrid, etc.)
- **Exactly‑once patterns** (outbox/inbox for webhook-driven steps)
- **Cron / scheduler** for deferred retries and time‑based compensations
- **Versioning & migrations** (evolve transaction definitions safely)
- **Secrets integration** (Nuxt runtimeConfig, per‑step headers, signing)
- **RBAC & policy hooks** for who/what can execute specific transactions

> Have an idea you need? Open an issue — we’re happy to prioritize features that unblock real workloads.

## Sponsorship ♥
If this project helps you ship faster, please consider sponsoring development.

- **Ko‑fi:** https://ko-fi.com/jamone19  
  <a href="https://ko-fi.com/jamone19"><img alt="Support me on ko-fi" src="https://ko-fi.com/img/githubbutton_sm.svg" /></a>

Thank you — your support helps us maintain the module, write docs, and build new features.



## End-to-End Demo (with mock server)

1) Start mock server

```bash
pnpm -w build
pnpm -C examples/mock-server i
pnpm -C examples/mock-server start
```

2) Start example app

```bash
pnpm -C examples/nuxt-app i
pnpm -C examples/nuxt-app dev
```

3) Call the transaction

```bash
curl -X POST http://localhost:3000/api/atomic/CreateUser   -H 'content-type: application/json'   -d '{"name":"Ada","email":"ada@lovelace.io","credits":50}'
```

See detailed walkthrough in `docs/mock-server.md`.


## Run in a podman container

```bash
podman run -it --rm -p 3200-3205:3000-3005 -v $(pwd):/app:z -v /app/node_modules node:22-alpine /bin/sh
apk add --update nodejs bash vim yarn git npm pnpm curl jq
bash
cd /app
```

## Concurrent demo runner

```bash
pnpm -w build
pnpm i
pnpm demo
# runs mock server (3001) and example Nuxt app (3000) together

# quick test
curl -X GET http://localhost:3001/health   -H 'content-type: application/json'   -d '{"name":"Ada","email":"ada@lovelace.io","credits":50}'
output:
{"ok":true}
```


## Test demo app
### Create once and capture Service A ID

```bash
RES=$(curl -sS -X POST http://localhost:3000/api/atomic/CreateUserEverywhere \
  -H 'content-type: application/json' \
  -d '{"name":"A","email":"a@a.com"}')

A_ID=$(echo "$RES" | jq -r '.results[] | select(.step=="CreateInServiceA") | .result.id')
echo "Service A ID: $A_ID"
```

### Hit mock endpoints directly
```bash
curl -sS "http://localhost:3001/mock/users/$A_ID/profile" | jq
curl -sS "http://localhost:3001/mock/users/$A_ID/recs" | jq
```

### Create a User across multiple services
```bash
curl -sS -X POST "http://localhost:3000/api/atomic/CreateUserEverywhere" \
  -H "content-type: application/json" \
  -d '{"name":"Alicia","email":"alicia@example.com"}' | jq
```

## E2E tests (Vitest)

> Requires you to install deps in both example folders.

```bash
pnpm -C examples/mock-server i
pnpm -C examples/nuxt-app i
pnpm test:e2e
```
The tests spin up both processes, verify **CreateUser** succeeds, and **CreateUserFail** triggers a rollback with a proper report.

### Quick health/handler checks

Unknown transaction (proves handler is mounted):

```bash
curl -sS -X POST "http://localhost:3000/api/atomic/Nope" -H "content-type: application/json" -d '{}' | jq
```


### Tail the atomic log (shows step execution & rollbacks):

```bash
tail -f examples/nuxt-app/.nuxt-atomic/logs/atomic.log
```

### Step modes (data passing)

Optionally set `mode` per step:

```ts
mode?: 'put' | 'get' | 'noop' // defaults: GET -> 'get', otherwise 'put'
```

- Results from **all** steps accumulate into `chainAcc`.
- Results from **get** steps accumulate into a **window** that resets after each **put**.
- Hydrators receive a composed payload:
  - For **get** steps: `{ ...original, ...chainAcc }`
  - For **put** steps: `{ ...original, ...chainAcc, ...getWindowSinceLastPut }`
This lets you create flows like: PUT → GET → GET → GET → PUT, where the second PUT can use original input plus the outputs of the three GETs.



## Typed hydrators

Import the helper and type your input/output precisely:

```ts
import { createHydrator } from '@nuxt/nuxt-atomic/runtime'

type In = { name: string; email: string } & Record<string, any>
type Out = { name: string; email: string }

export const hydrate = createHydrator<In, Out>((input, ctx) => {
  return { name: input.name, email: input.email }
})
```

Hydrators receive a composed `input` plus a context with `chainAcc`, `windowAcc`, etc.



## PNPM workspace

The repo includes a workspace so one install wires everything:

```bash
pnpm i
```

`pnpm-workspace.yaml` includes `examples/*`, so example apps share the root lockfile and hoisted deps.



## Example: PUT → GET → GET → PUT

- **Step 1 (PUT)** `CreateInServiceA`: creates a user in Service A and returns `{ id, ... }`.
- **Step 2 (GET)** `FetchAProfile`: fetches a profile for `:id`. Result is added to the **GET-window**.
- **Step 3 (GET)** `FetchARecommendations`: fetches recommendations for `:id`. Also added to the **GET-window**.
- **Step 4 (PUT)** `CreateInServiceB`: receives `original + chainAcc + windowAcc`. This includes the `id` from Step 1 and the profile/recommendations from Steps 2–3. After this step, the **GET-window** is cleared.

Call it:

```bash
curl -X POST http://localhost:3000/api/atomic/CreateUserEverywhere   -H 'content-type: application/json'   -d '{"name":"Alicia","email":"alicia@example.com"}'
```

## Coverage

E2E tests run in a separate process model (mock server + Nuxt app), so coverage reflects code executed directly in the test process (e.g., helpers). We still publish reports for visibility.

- Local:

  ```bash
  pnpm test:e2e
  # open coverage/index.html
  ```

- CI uploads `coverage/` as an artifact named **coverage-report**.



### Programmatic Nuxt boot in tests
The E2E suite boots **Nuxt** inside the **Vitest** process using `loadNuxt` + `buildNuxt`, and starts the **mock server** in-process as well. This improves V8 coverage for the server handler code paths.


## Branding
SVGs live in `branding/` (icon, horizontal, stacked). Drop the horizontal lockup at the top of this README:

```md
<p align="center">
  <img src="./branding/nuxt-atomic-logo-horizontal.svg" width="640" alt="Nuxt Atomic" />
</p>
```

## License
MIT
