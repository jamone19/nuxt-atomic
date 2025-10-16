
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxt/nuxt-atomic'],
  nitro: { preset: 'node-server' },

  atomic: {
    baseRoute: '/api/atomic',
    logDir: '.nuxt-atomic/logs',
    transactions: {
      CreateUser: {
        steps: [
          {
            key: 'CreateDBUser',
            execute: { method: 'POST', url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate: { module: '~/atomic/steps/userCreate' }
          },
          {
            key: 'GrantWelcomeCredits',
            execute: { method: 'POST', url: 'http://localhost:3001/mock/credits' },
            rollback: { method: 'POST', url: 'http://localhost:3001/mock/credits/revoke' },
            hydrate: { module: '~/atomic/steps/grantCredits', export: 'hydrate' }
          }
        ]
      },
      CreateUserFail: {
        steps: [
          {
            key: 'CreateDBUser',
            execute: { method: 'POST', url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate: { module: '~/atomic/steps/userCreate' }
          },
          {
            // That’s intentional in the sample: the step points to http://localhost:3999/nowhere 
		  // to demonstrate compensating rollbacks. Your output shows the rollback of 
		  // CreateDBUser ran and succeeded, which is exactly what we want to showcase.

            // If you want CreateUserFail to succeed, change that step’s URL in examples/nuxt-app/nuxt.config.ts 
		  // to a real endpoint (e.g. the same credits service on port 3001), rebuild, and run again.
            key: 'GrantWelcomeCredits',
            execute: { method: 'POST', url: 'http://localhost:3999/nowhere' }, // force failure
            rollback: { method: 'POST', url: 'http://localhost:3001/mock/credits/revoke' },
            hydrate: { module: '~/atomic/steps/grantCredits', export: 'hydrate' }
          }
        ]
      },
      /** PUT → GET → GET → PUT flow that composes IDs + fetched data */
      CreateUserEverywhere: {
        steps: [
          {
            key: 'CreateInServiceA',
            // mode inferred: 'put' (POST)
            execute:  { method: 'POST', url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate:  { module: '~/atomic/steps/createA' }
          },
          {
            key: 'FetchAProfile',
            // mode inferred: 'get' (GET) — adds to windowAcc
            execute:  { method: 'GET', url: 'http://localhost:3001/mock/users/:id/profile' },
            rollback: { method: 'POST', url: 'http://localhost:3001/mock/credits/revoke' }, // no-op path
            hydrate:  { module: '~/atomic/steps/fetchAProfile' }
          },
          {
            key: 'FetchARecommendations',
            // another GET — merged into the same GET-window
            execute:  { method: 'GET', url: 'http://localhost:3001/mock/users/:id/recs' },
            rollback: { method: 'POST', url: 'http://localhost:3001/mock/credits/revoke' },
            hydrate:  { module: '~/atomic/steps/fetchARecs' }
          },
          {
            key: 'CreateInServiceB',
            // mode inferred: 'put' (POST) — will receive original + chainAcc + windowAcc
            execute:  { method: 'POST', url: 'http://localhost:3001/mock/users' },
            rollback: { method: 'DELETE', url: 'http://localhost:3001/mock/users/:id' },
            hydrate:  { module: '~/atomic/steps/createB' }
          }
        ]
      }
    }
  }
})
