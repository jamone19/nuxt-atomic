// src/module.ts
import {
  defineNuxtModule,
  createResolver,
  useLogger,
} from '@nuxt/kit'

export interface ApiCallDef {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers?: Record<string, string>
}
export interface HydrateRef { module: string; export?: string }
export interface StepDefinition {
  key: string
  execute: ApiCallDef
  rollback: ApiCallDef
  hydrate: HydrateRef | string
  mode?: 'put' | 'get' | 'noop'
}
export interface TransactionDefinition { steps: StepDefinition[] }
export interface ModuleOptions {
  baseRoute?: string
  logDir?: string
  registryPath?: string
  transactions?: Record<string, TransactionDefinition>
}

export default defineNuxtModule<ModuleOptions>({
  meta: { name: '@nuxt/nuxt-atomic', configKey: 'atomic', compatibility: { nuxt: '>=3.12.0' } },
  defaults: { baseRoute: '/api/atomic', logDir: '.nuxt-atomic/logs', transactions: {} },

  async setup (options, nuxt) {
    const logger = useLogger('@nuxt/nuxt-atomic')
    const { resolve } = createResolver(import.meta.url)

    // Runtime config for handler
    nuxt.options.runtimeConfig.public.__atomic__ = { baseRoute: options.baseRoute }
    // @ts-ignore
    nuxt.options.runtimeConfig.__atomic__ = { logDir: options.logDir }

    // Handler factory path (from our built bundle)
    const handlerFactoryPath = resolve('./runtime/server/atomicHandler')

    // Build a Nitro virtual module that statically imports *exact* hydrator exports
    const virtualId = '#nuxt-atomic/route'
    nuxt.hook('nitro:config', (nitro) => {
      const txs = options.transactions || {}

      const importLines: string[] = []
      const txEntries: string[] = []
      let i = 0

      for (const [txName, txDef] of Object.entries(txs)) {
        const steps: string[] = []

        for (const step of txDef.steps) {
          // Normalize the hydrate descriptor
          const href: HydrateRef = typeof step.hydrate === 'string'
            ? { module: step.hydrate, export: 'hydrate' }
            : (step.hydrate as HydrateRef)

          const exp = href.export || 'hydrate'
          const varName = `__h${i++}_${txName.replace(/[^A-Za-z0-9_]/g,'_')}_${step.key.replace(/[^A-Za-z0-9_]/g,'_')}`

          // Generate a precise import that matches the declared export
          if (exp === 'default') {
            importLines.push(`import ${varName} from '${href.module}'`)
          } else {
            importLines.push(`import { ${exp} as ${varName} } from '${href.module}'`)
          }

          steps.push(`{ key: ${JSON.stringify(step.key)}, execute: ${JSON.stringify(step.execute)}, rollback: ${JSON.stringify(step.rollback)}, ${step.mode ? `mode: ${JSON.stringify(step.mode)}, ` : ''}hydrate: ${varName} }`)
        }

        txEntries.push(`${JSON.stringify(txName)}: { steps: [\n        ${steps.join(',\n        ')}\n      ] }`)
      }

      const code =
`import { createAtomicHandler } from '${handlerFactoryPath}'
${importLines.join('\n')}
const transactions = {
  ${txEntries.join(',\n  ')}
}
export default createAtomicHandler(transactions)
`

      nitro.virtual = nitro.virtual || {}
      nitro.virtual[virtualId] = code

      nitro.handlers = nitro.handlers || []
      nitro.handlers.push({ route: `${options.baseRoute}/:name`, handler: virtualId })
      for (const name of Object.keys(options.transactions || {})) {
        nitro.handlers.push({ route: `${options.baseRoute}/${name}`, handler: virtualId })
      }
    })

    logger.success(`Registered atomic routes at ${options.baseRoute}`)
  }
})

