
# Mock Server

A minimal Express server to simulate side-effect APIs used by the Nuxt Atomic demo.

**Endpoints (port 3001):**
- `POST /mock/users` -> `{ id, name, email }`
- `DELETE /mock/users/:id` -> `{ ok: true }`
- `POST /mock/credits` -> `{ ok: true, userId, amount }`
- `POST /mock/credits/revoke` -> `{ ok: true, userId?, amount? }`

Run:
```bash
pnpm i
pnpm start
# or: npm i && npm start / yarn && yarn start
```
