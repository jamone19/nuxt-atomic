// build.config.ts
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/module',
    './src/runtime/index',               // public runtime exports
    './src/runtime/server/atomicHandler' // Nitro handler (must be built)
  ],
  clean: true,
  declaration: true,
  rollup: { emitCJS: true },
  // 👇 These exist only at runtime in the host app
  externals: ['h3', '#build/atomic/transactions.mjs'],
  // Optional (silences non-fatal warnings from rollup plugins)
  failOnWarn: false
})

