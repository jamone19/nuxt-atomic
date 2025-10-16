import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/module',
    './src/runtime/index',
    './src/runtime/server/atomicHandler' // factory only, no default export
  ],
  clean: true,
  declaration: true,
  rollup: { emitCJS: true },
  externals: ['h3'],
  failOnWarn: false
})

