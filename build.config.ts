
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['./src/module', './src/runtime/index'],
  clean: true,
  declaration: true,
  rollup: { emitCJS: true }
})
