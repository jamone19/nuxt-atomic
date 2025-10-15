
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['examples/e2e/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      enabled: true,
      all: false, // Only files touched by tests (E2E spawns separate procs, so expect limited coverage)
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'examples/**/node_modules/**',
        'examples/mock-server/**',
        'dist/**',
        '.nuxt/**',
        '.nitro/**'
      ]
    }
  }
})
