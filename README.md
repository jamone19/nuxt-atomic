
# @nuxt/nuxt-atomic

Atomic (saga-like) multi-step transactions for Nuxt 4 with automatic server routes, rollback orchestration, and structured logging.

- Register transactions with one or many internal steps.
- Each step defines `execute`, `rollback`, and a `hydrate` function that transforms your source payload into the step's API input.
- Automatic server routes: call `POST /api/atomic/<TransactionName>` with your source payload to run the transaction.
- If a step fails, prior successful steps are rolled back in reverse order. Failures are logged and returned.
- Works with any package manager: `yarn add @nuxt/nuxt-atomic`, `pnpm add @nuxt/nuxt-atomic`, or `npm i @nuxt/nuxt-atomic`.

## Quickstart

1. Install
```bash
pnpm add @nuxt/nuxt-atomic
# or
yarn add @nuxt/nuxt-atomic
# or
npm i @nuxt/nuxt-atomic
```

2. Add to `nuxt.config.ts` and register transactions.
```ts
export default defineNuxtConfig({
  modules: ['@nuxt/nuxt-atomic'],

  atomic: {
    baseRoute: '/api/atomic',              // optional, default '/api/atomic'
    logDir: '.nuxt-atomic/logs',           // optional
    // Register steps in a registry file or inline (recommended: registry file)
    registryPath: '~/atomic/registry',     // path without extension, module will resolve .ts/.js
    transactions: {
      CreateUser: {
        steps: [
          {
            key: 'CreateDBUser',
            execute: { method: 'POST', url: 'https://example.com/users' },
            rollback: { method: 'DELETE', url: 'https://example.com/users/:id' },
            hydrate: { module: '~/atomic/steps/userCreate', export: 'hydrateCreate' }
          },
          {
            key: 'GrantWelcomeCredits',
            execute: { method: 'POST', url: 'https://example.com/credits' },
            rollback: { method: 'POST', url: 'https://example.com/credits/revoke' },
            hydrate: { module: '~/atomic/steps/grantCredits', export: 'hydrate' }
          }
        ]
      }
    }
  }
})
```

3. Provide hydrate/translation functions in your project, e.g. `~/atomic/steps/userCreate.ts`:
```ts
export const hydrateCreate = (source, ctx) => {
  // translate input from your request body to the execute API payload
  return { name: source.name, email: source.email }
}
export const hydrateRollback = (result, source, ctx) => {
  // optionally use result from execution to prepare rollback payloads
  return { id: result?.id }
}
```

4. Run a transaction
```bash
curl -X POST http://localhost:3000/api/atomic/CreateUser   -H 'content-type: application/json'   -d '{"name":"Ada","email":"ada@lovelace.io"}'
```

For a full, runnable sample, see `examples/nuxt-app`.



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


## run in podman container
podman run -it --rm -p 3200-3205:3000-3005 -v $(pwd):/app:z -v /app/node_modules node:22-alpine /bin/sh
apk add --update nodejs bash vim yarn git npm pnpm curl jq
bash
cd /app

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

## E2E tests (Vitest)

> Requires you to install deps in both example folders.

```bash
pnpm -C examples/mock-server i
pnpm -C examples/nuxt-app i
pnpm test:e2e
```
The tests spin up both processes, verify **CreateUser** succeeds, and **CreateUserFail** triggers a rollback with a proper report.



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
