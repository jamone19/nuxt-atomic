
# Example Nuxt App

This example assumes mock endpoints running locally (you can easily spin them up with any mock server).
- `POST http://localhost:3001/mock/users` -> returns `{ id, name, email }`
- `DELETE http://localhost:3001/mock/users/:id` -> returns `{ ok: true }`
- `POST http://localhost:3001/mock/credits` -> returns `{ ok: true }`
- `POST http://localhost:3001/mock/credits/revoke` -> returns `{ ok: true }`

Update the URLs in `nuxt.config.ts` to match your environment.
