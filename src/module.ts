
import { defineNuxtModule, addServerHandler, createResolver, addTemplate, useLogger } from '@nuxt/kit'

export interface ApiCallDef {
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'
  url: string
  headers?: Record<string,string>
}

export interface HydrateRef {
  module: string       // path to a module exporting the function
  export?: string      // named export, defaults to 'hydrate'
}

export interface StepDefinition {
  key: string
  execute: ApiCallDef
  rollback: ApiCallDef
  hydrate: HydrateRef | string // string is a module path, export defaults to 'hydrate'
}

export interface TransactionDefinition {
  steps: StepDefinition[]
}

export interface ModuleOptions {
  baseRoute?: string
  logDir?: string
  registryPath?: string
  transactions?: Record<string, TransactionDefinition>
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@nuxt/nuxt-atomic',
    configKey: 'atomic',
    compatibility: { nuxt: '>=3.12.0' }
  },
  defaults: {
    baseRoute: '/api/atomic',
    logDir: '.nuxt-atomic/logs',
    transactions: {}
  },
  async setup (options, nuxt) {
    const logger = useLogger('@nuxt/nuxt-atomic')
    const { resolve } = createResolver(import.meta.url)

    // Expose runtime config for handler
    nuxt.options.runtimeConfig.public.__atomic__ = {
      baseRoute: options.baseRoute
    }
    nuxt.options.runtimeConfig.__atomic__ = {
      logDir: options.logDir
    }

    // Generate a virtual JSON of transactions (serializable only)
    addTemplate({
      filename: 'atomic/transactions.mjs',
      getContents: () => `export default ${JSON.stringify(options.transactions || {}, null, 2)}`
    })

    // Generic handler that supports both dynamic and specific routes
    const handlerPath = resolve('./runtime/server/atomicHandler')

    // Dynamic catch-all: /api/atomic/:name
    addServerHandler({
      route: `${options.baseRoute}/:name`,
      handler: handlerPath
    })

    // Also add specific routes for each transaction name for ergonomics
    Object.keys(options.transactions || {}).forEach((name) => {
      addServerHandler({
        route: `${options.baseRoute}/${name}`,
        handler: handlerPath
      })
    })

    logger.success(`Registered atomic routes at ${options.baseRoute}`)
  }
})
