
# End-to-End Demo with Mock Server

This guide shows the atomic transaction flow using the included mock server and the example Nuxt app.

## 1) Start the mock server (port 3001)

```bash
cd examples/mock-server
pnpm i
pnpm start
# Output: [mock] listening on http://localhost:3001
```

APIs used by the transaction:
- `POST http://localhost:3001/mock/users` -> `{ id, name, email }`
- `DELETE http://localhost:3001/mock/users/:id` -> `{ ok: true }`
- `POST http://localhost:3001/mock/credits` -> `{ ok: true, userId, amount }`
- `POST http://localhost:3001/mock/credits/revoke` -> `{ ok: true, userId?, amount? }`

## 2) Run the example Nuxt app

Open a second terminal:
```bash
cd examples/nuxt-app
pnpm i
pnpm dev
# App at http://localhost:3000
```

The example registers a `CreateUser` transaction with two steps:
1. `CreateDBUser` -> `POST /mock/users`
2. `GrantWelcomeCredits` -> `POST /mock/credits`

Rollback paths:
- `DELETE /mock/users/:id`
- `POST /mock/credits/revoke`

## 3) Execute the transaction

From a third terminal or via the example page UI:

```bash
curl -X POST http://localhost:3000/api/atomic/CreateUser   -H 'content-type: application/json'   -d '{"name":"Ada","email":"ada@lovelace.io","credits":50}'
```

### Expected success response
```json
{
  "ok": true,
  "transaction": "CreateUser",
  "results": [
    { "step": "CreateDBUser", "result": { "id": "<id>", "name": "Ada", "email": "ada@lovelace.io" } },
    { "step": "GrantWelcomeCredits", "result": { "ok": true, "userId": "<id>", "amount": 50 } }
  ]
}
```

### Failure & rollback (how to simulate)
Stop the mock server after the first step or change the credits endpoint URL to an invalid host, then run the transaction again.  
You should get a response like:
```json
{
  "ok": false,
  "transaction": "CreateUser",
  "failedStep": "GrantWelcomeCredits",
  "error": "fetch failed ...",
  "rollback": [
    { "key": "CreateDBUser", "ok": true }
  ]
}
```

## 4) Logs
JSONL file at `.nuxt-atomic/logs/atomic.log` within the example app project:
- Transaction start
- Each step execute
- Errors
- Rollback attempts and outcomes
- Final success



## Example: PUT → GET → GET → PUT

- **Step 1 (PUT)** `CreateInServiceA`: creates a user in Service A and returns `{ id, ... }`.
- **Step 2 (GET)** `FetchAProfile`: fetches a profile for `:id`. Result is added to the **GET-window**.
- **Step 3 (GET)** `FetchARecommendations`: fetches recommendations for `:id`. Also added to the **GET-window**.
- **Step 4 (PUT)** `CreateInServiceB`: receives `original + chainAcc + windowAcc`. This includes the `id` from Step 1 and the profile/recommendations from Steps 2–3. After this step, the **GET-window** is cleared.

Call it:
```bash
curl -X POST http://localhost:3000/api/atomic/CreateUserEverywhere   -H 'content-type: application/json'   -d '{"name":"Alicia","email":"alicia@example.com"}'
```
