
import { createMockServer } from './app.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const started = await createMockServer(PORT)
console.log(`[mock] listening on http://localhost:${PORT}`)
