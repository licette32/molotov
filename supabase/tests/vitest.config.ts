import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files serially so each suite gets a clean DB state.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
